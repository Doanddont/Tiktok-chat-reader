export interface TikTokUser {
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
  followRole: number;
  userBadges: UserBadge[];
  isModerator: boolean;
  isNewGifter: boolean;
  isSubscriber: boolean;
  topGifterRank: number | null;
  teamMemberLevel: number;
}

export interface UserBadge {
  type: string;
  name: string;
  url: string;
}

export interface ChatMessage {
  type: "chat";
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
  comment: string;
  followRole: number;
  userBadges: UserBadge[];
  isModerator: boolean;
  isNewGifter: boolean;
  isSubscriber: boolean;
  topGifterRank: number | null;
  teamMemberLevel: number;
  msgId: string;
  createTime: string;
}

export interface GiftMessage {
  type: "gift";
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
  giftId: number;
  giftName: string;
  giftPictureUrl: string;
  diamondCount: number;
  repeatCount: number;
  repeatEnd: boolean;
  giftType: number;
  describe: string;
}

export interface LikeMessage {
  type: "like";
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
  likeCount: number;
  totalLikeCount: number;
}

export interface MemberMessage {
  type: "member";
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
  action: number;
}

export interface SocialMessage {
  type: "social";
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
  displayType: string;
  label: string;
}

export interface FollowMessage {
  type: "follow";
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
}

export interface ShareMessage {
  type: "share";
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
}

export interface SubscribeMessage {
  type: "subscribe";
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
  subMonth: number;
}

export interface QuestionMessage {
  type: "question";
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
  questionText: string;
}

export interface RoomUserMessage {
  type: "roomUser";
  viewerCount: number;
  topViewers: any[];
}

export interface StreamEndMessage {
  type: "streamEnd";
  action: number;
}

export type TikTokEvent =
  | ChatMessage
  | GiftMessage
  | LikeMessage
  | MemberMessage
  | SocialMessage
  | FollowMessage
  | ShareMessage
  | SubscribeMessage
  | QuestionMessage
  | RoomUserMessage
  | StreamEndMessage;

export interface WSClientMessage {
  action: "connect" | "disconnect";
  uniqueId?: string;
  options?: Record<string, any>;
  connectionType?: ConnectionType;
}

export interface WSServerMessage {
  event: string;
  data: any;
}

export interface StreamStats {
  viewerCount: number;
  likeCount: number;
  totalLikes: number;
  diamondsCount: number;
  giftCount: number;
  chatCount: number;
  followerCount: number;
  shareCount: number;
  joinCount: number;
  connectedSince: string | null;
  uniqueId: string | null;
}

export type EventFilterType = "chat" | "gift" | "like" | "follow" | "share" | "join" | "subscribe" | "question";

export interface FilterConfig {
  enabledEvents: Record<EventFilterType, boolean>;
  textFilter: string;
  usernameFilter: string;
  minGiftDiamonds: number;
  showModOnly: boolean;
  showSubOnly: boolean;
}

// New types for dual connection support
export type ConnectionType = "connector" | "euler" | "auto";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "failed";

export interface ConnectionState {
  type: ConnectionType;
  activeMethod: "connector" | "euler" | null;
  status: ConnectionStatus;
  uniqueId: string | null;
  connectedSince: string | null;
  failureReason: string | null;
  fallbackUsed: boolean;
}

export interface ConnectionInfo {
  state: ConnectionState;
  stats: StreamStats;
  connectorVersion: string | null;
}
