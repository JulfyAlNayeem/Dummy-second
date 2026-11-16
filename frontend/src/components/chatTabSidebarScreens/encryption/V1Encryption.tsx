import React from "react";
import CorruptionSettings from "./CorruptionSettings";

type Props = {
  conversationId: string;
  socketRef: any;
  currentUserId: string;
  otherUserId?: string;
};

const V1Encryption = ({
  conversationId,
  currentUserId,
  otherUserId,
}: Props): JSX.Element => (
  <CorruptionSettings
    conversationId={conversationId}
    currentUserId={currentUserId}
    otherUserId={otherUserId}
  />
);

export default V1Encryption;
