import Map "mo:core/Map";
import List "mo:core/List";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import AccessControl "mo:caffeineai-authorization/access-control";
import Storage "mo:caffeineai-object-storage/Storage";
import MixinObjectStorage "mo:caffeineai-object-storage/Mixin";
import Time "mo:core/Time";
import Iter "mo:core/Iter";
import Order "mo:core/Order";
import Array "mo:core/Array";
import Int "mo:core/Int";

actor {
  // Mixins
  include MixinObjectStorage();

  // Authorization
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Types
  type UserId = Principal;

  type RetentionPolicy = {
    #forever;
    #deleteAfter24h;
  };

  public type UserProfile = {
    username : Text;
    retention : RetentionPolicy;
  };

  module UserProfile {
    public func compare(p1 : UserProfile, p2 : UserProfile) : Order.Order {
      Text.compare(p1.username, p2.username);
    };
  };

  type ContactRequest = {
    from : UserId;
    to : UserId;
    status : {
      #pending;
      #accepted;
      #rejected;
    };
  };

  type Snap = {
    id : Text;
    sender : UserId;
    receiver : UserId;
    blobId : Storage.ExternalBlob;
    timestamp : Time.Time;
    opened : Bool;
  };

  type Message = {
    id : Nat;
    sender : UserId;
    receiver : UserId;
    content : Text;
    timestamp : Time.Time;
    isSnapEvent : Bool;
    snapId : ?Text;
  };

  module Message {
    public func compare(m1 : Message, m2 : Message) : Order.Order {
      Int.compare(m1.timestamp, m2.timestamp);
    };
  };

  // Comparison function for ContactRequest
  module ContactRequest {
    public func compare(c1 : ContactRequest, c2 : ContactRequest) : Order.Order {
      Int.compare(c1.from.toText().size(), c2.from.toText().size());
    };
  };

  // Data Stores
  let userProfiles = Map.empty<UserId, UserProfile>();
  let usernameMap = Map.empty<Text, UserId>();
  let contactRequests = Map.empty<UserId, List.List<ContactRequest>>();
  let messages = Map.empty<UserId, List.List<Message>>();
  let snaps = Map.empty<Text, Snap>();
  // Index: receiver -> list of their unopened snap IDs.
  // Lets listUnopenedSnaps look up a single user's snaps instead of scanning all snaps globally.
  let unopenedSnapsByReceiver = Map.empty<UserId, List.List<Text>>();
  var nextMessageId = 0;

  // Helper: check accepted request in a single user's list
  func hasAcceptedRequest(listOwner : UserId, user1 : UserId, user2 : UserId) : Bool {
    switch (contactRequests.get(listOwner)) {
      case (null) { false };
      case (?requests) {
        let found = requests.filter(
          func(req : ContactRequest) : Bool {
            req.status == #accepted and (
              (req.from == user1 and req.to == user2) or
              (req.from == user2 and req.to == user1)
            )
          }
        );
        found.toArray().size() > 0;
      };
    };
  };

  // Helper function to check if two users are contacts.
  // Contact requests are stored only in the recipient's list, so we must
  // check both users' lists to cover both directions.
  func areContacts(user1 : UserId, user2 : UserId) : Bool {
    hasAcceptedRequest(user1, user1, user2) or hasAcceptedRequest(user2, user1, user2);
  };

  // Clean a single user's messages according to their own retention policy.
  // Scoped to one user so it stays O(that user's messages) instead of scanning everyone
  // on every message send.
  func cleanMessagesFor(userId : UserId) {
    switch (userProfiles.get(userId)) {
      case (null) {};
      case (?profile) {
        if (profile.retention == #deleteAfter24h) {
          switch (messages.get(userId)) {
            case (null) {};
            case (?msgList) {
              let now = Time.now();
              let twentyFourHours : Int = 24 * 60 * 60 * 1_000_000_000; // 24 hours in nanoseconds
              let filteredMessages = msgList.filter(
                func(msg : Message) : Bool {
                  (now - msg.timestamp) < twentyFourHours
                }
              );
              messages.add(userId, filteredMessages);
            };
          };
        };
      };
    };
  };

  // Required profile management functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    
    // Check if username is already taken by another user
    switch (usernameMap.get(profile.username)) {
      case (null) {
        // Username available
        // Remove old username mapping if exists
        switch (userProfiles.get(caller)) {
          case (null) {};
          case (?oldProfile) {
            usernameMap.remove(oldProfile.username);
          };
        };
        usernameMap.add(profile.username, caller);
        userProfiles.add(caller, profile);
      };
      case (?existingUser) {
        if (existingUser != caller) {
          Runtime.trap("Username already taken");
        };
        userProfiles.add(caller, profile);
      };
    };
  };

  // User Management
  public shared ({ caller }) func register(username : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can register");
    };
    if (userProfiles.containsKey(caller)) {
      Runtime.trap("User already registered");
    };
    switch (usernameMap.get(username)) {
      case (null) {};
      case (?_) {
        Runtime.trap("Username already taken");
      };
    };
    let profile : UserProfile = {
      username;
      retention = #forever;
    };
    userProfiles.add(caller, profile);
    usernameMap.add(username, caller);
  };

  public shared ({ caller }) func updateRetention(policy : RetentionPolicy) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can update retention");
    };
    switch (userProfiles.get(caller)) {
      case (null) { Runtime.trap("User not found") };
      case (?profile) {
        userProfiles.add(caller, { profile with retention = policy });
      };
    };
  };

  // Search any registered user by principal (public within authenticated users)
  public query ({ caller }) func getUserByPrincipal(id : UserId) : async UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view profiles");
    };
    switch (userProfiles.get(id)) {
      case (null) { Runtime.trap("User not found") };
      case (?profile) { profile };
    };
  };

  // Search any registered user by username and return their principal too
  public query ({ caller }) func findUserByUsername(username : Text) : async ?(UserProfile, UserId) {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can search users");
    };
    switch (usernameMap.get(username)) {
      case (null) { null };
      case (?id) {
        switch (userProfiles.get(id)) {
          case (null) { null };
          case (?profile) { ?(profile, id) };
        };
      };
    };
  };

  // Legacy: kept for profile resolution in lists (own profile only)
  public query ({ caller }) func getUserByUsername(username : Text) : async UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view profiles");
    };
    switch (usernameMap.get(username)) {
      case (null) { Runtime.trap("Username not found") };
      case (?id) {
        switch (userProfiles.get(id)) {
          case (null) { Runtime.trap("User not found") };
          case (?profile) { profile };
        };
      };
    };
  };

  // Contacts
  public shared ({ caller }) func sendContactRequest(to : UserId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can send contact requests");
    };
    if (not userProfiles.containsKey(caller)) {
      Runtime.trap("Sender not registered");
    };
    if (not userProfiles.containsKey(to)) {
      Runtime.trap("Recipient not found");
    };
    if (caller == to) {
      Runtime.trap("Cannot send contact request to yourself");
    };
    let request : ContactRequest = {
      from = caller;
      to;
      status = #pending;
    };
    let existingRequests = switch (contactRequests.get(to)) {
      case (null) { List.empty<ContactRequest>() };
      case (?reqs) { reqs };
    };
    existingRequests.add(request);
    contactRequests.add(to, existingRequests);
  };

  public shared ({ caller }) func acceptContactRequest(from : UserId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can accept contact requests");
    };
    switch (contactRequests.get(caller)) {
      case (null) { Runtime.trap("No contact requests found") };
      case (?requests) {
        let updatedRequests = requests.map<ContactRequest, ContactRequest>(
          func(req) {
            if (req.from == from and req.to == caller and req.status == #pending) {
              { req with status = #accepted };
            } else { req };
          }
        );
        contactRequests.add(caller, updatedRequests);
      };
    };
  };

  public shared ({ caller }) func rejectContactRequest(from : UserId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can reject contact requests");
    };
    switch (contactRequests.get(caller)) {
      case (null) { Runtime.trap("No contact requests found") };
      case (?requests) {
        let updatedRequests = requests.map<ContactRequest, ContactRequest>(
          func(req) {
            if (req.from == from and req.to == caller and req.status == #pending) {
              { req with status = #rejected };
            } else { req };
          }
        );
        contactRequests.add(caller, updatedRequests);
      };
    };
  };

  public query ({ caller }) func listContacts() : async [(UserId, ContactRequest)] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can list contacts");
    };
    let contactList = List.empty<(UserId, ContactRequest)>();
    
    // Check requests where caller is the recipient
    switch (contactRequests.get(caller)) {
      case (null) {};
      case (?requests) {
        let accepted = requests.filter(
          func(req : ContactRequest) : Bool {
            req.to == caller and req.status == #accepted
          }
        );
        for (req in accepted.toArray().values()) {
          contactList.add((req.from, req));
        };
      };
    };
    
    // Check requests where caller is the sender
    for ((userId, requests) in contactRequests.entries()) {
      let accepted = requests.filter(
        func(req : ContactRequest) : Bool {
          req.from == caller and req.to == userId and req.status == #accepted
        }
      );
      for (req in accepted.toArray().values()) {
        contactList.add((req.to, req));
      };
    };
    
    contactList.toArray();
  };

  public query ({ caller }) func listPendingRequests() : async [(UserId, ContactRequest)] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can list pending requests");
    };
    let requestList = List.empty<(UserId, ContactRequest)>();
    switch (contactRequests.get(caller)) {
      case (null) {};
      case (?requests) {
        let pending = requests.filter(
          func(req : ContactRequest) : Bool {
            req.to == caller and req.status == #pending
          }
        );
        for (req in pending.toArray().values()) {
          requestList.add((req.from, req));
        };
      };
    };
    requestList.toArray();
  };

  // Snaps
  public shared ({ caller }) func sendSnap(receiver : UserId, blobId : Storage.ExternalBlob) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can send snaps");
    };
    if (not userProfiles.containsKey(caller)) {
      Runtime.trap("Sender not registered");
    };
    if (not userProfiles.containsKey(receiver)) {
      Runtime.trap("Receiver not found");
    };
    if (not areContacts(caller, receiver)) {
      Runtime.trap("Can only send snaps to contacts");
    };
    
    let snapId = Time.now().toText() # caller.toText() # receiver.toText();
    let snap : Snap = {
      id = snapId;
      sender = caller;
      receiver;
      blobId;
      timestamp = Time.now();
      opened = false;
    };
    snaps.add(snapId, snap);
    // Maintain the per-receiver index for fast unopened-snap lookups
    let receiverSnaps = switch (unopenedSnapsByReceiver.get(receiver)) {
      case (null) { List.empty<Text>() };
      case (?ids) { ids };
    };
    receiverSnaps.add(snapId);
    unopenedSnapsByReceiver.add(receiver, receiverSnaps);
    snapId;
  };

  public shared ({ caller }) func openSnap(snapId : Text) : async Storage.ExternalBlob {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can open snaps");
    };
    switch (snaps.get(snapId)) {
      case (null) { Runtime.trap("Snap not found") };
      case (?snap) {
        if (snap.receiver != caller) {
          Runtime.trap("Unauthorized: Can only open snaps sent to you");
        };
        snaps.remove(snapId);
        // Keep the per-receiver index in sync
        switch (unopenedSnapsByReceiver.get(snap.receiver)) {
          case (null) {};
          case (?ids) {
            let remaining = ids.filter(func(id : Text) : Bool { id != snapId });
            unopenedSnapsByReceiver.add(snap.receiver, remaining);
          };
        };
        snap.blobId;
      };
    };
  };

  public query ({ caller }) func listUnopenedSnaps() : async [Snap] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can list snaps");
    };
    let unopenedSnaps = List.empty<Snap>();
    switch (unopenedSnapsByReceiver.get(caller)) {
      case (null) {};
      case (?ids) {
        for (id in ids.toArray().values()) {
          switch (snaps.get(id)) {
            case (null) {};
            case (?snap) {
              if (not snap.opened) {
                unopenedSnaps.add(snap);
              };
            };
          };
        };
      };
    };
    unopenedSnaps.toArray();
  };

  // Messages
  public shared ({ caller }) func sendMessage(receiver : UserId, content : Text, isSnapEvent : Bool) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can send messages");
    };
    if (not userProfiles.containsKey(caller)) {
      Runtime.trap("Sender not registered");
    };
    if (not userProfiles.containsKey(receiver)) {
      Runtime.trap("Receiver not found");
    };
    if (not areContacts(caller, receiver)) {
      Runtime.trap("Can only send messages to contacts");
    };
    
    cleanMessagesFor(caller);
    cleanMessagesFor(receiver);

    let messageId = nextMessageId;
    nextMessageId += 1;
    let message : Message = {
      id = messageId;
      sender = caller;
      receiver;
      content;
      timestamp = Time.now();
      isSnapEvent;
      snapId = null;
    };
    let senderMessages = switch (messages.get(caller)) {
      case (null) { List.empty<Message>() };
      case (?msgs) { msgs };
    };
    senderMessages.add(message);
    messages.add(caller, senderMessages);
    let receiverMessages = switch (messages.get(receiver)) {
      case (null) { List.empty<Message>() };
      case (?msgs) { msgs };
    };
    receiverMessages.add(message);
    messages.add(receiver, receiverMessages);
    messageId;
  };

  public query ({ caller }) func getConversationHistory(otherUser : UserId) : async [Message] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view conversations");
    };
    if (not areContacts(caller, otherUser)) {
      Runtime.trap("Can only view conversations with contacts");
    };
    
    let conversationMessages = List.empty<Message>();
    
    // Get messages from caller's perspective
    switch (messages.get(caller)) {
      case (null) {};
      case (?msgs) {
        let relevant = msgs.filter(
          func(msg : Message) : Bool {
            (msg.sender == caller and msg.receiver == otherUser) or
            (msg.sender == otherUser and msg.receiver == caller)
          }
        );
        for (msg in relevant.toArray().values()) {
          conversationMessages.add(msg);
        };
      };
    };
    
    // Apply the caller's retention policy at read time, so the 24h rule still holds
    // for the viewer even when no cleanup write has happened recently.
    let visibleMessages = switch (userProfiles.get(caller)) {
      case (?profile) {
        if (profile.retention == #deleteAfter24h) {
          let now = Time.now();
          let twentyFourHours : Int = 24 * 60 * 60 * 1_000_000_000;
          conversationMessages.filter(
            func(msg : Message) : Bool {
              (now - msg.timestamp) < twentyFourHours
            }
          );
        } else { conversationMessages };
      };
      case (null) { conversationMessages };
    };

    // Sort by timestamp
    let sortedMessages = visibleMessages.toArray();
    sortedMessages.sort();
  };
};
