// @ts-nocheck
// --- Shared Corruption Layer Utilities ---
// Used by both V1 (CryptoJS) and ECDH encryption

// Default settings
const DEFAULT_POSITIONS = [5, 9, 15, 20, 30];
const DEFAULT_KEY_LENGTH = 4;

// Get corruption settings from localStorage
export function getCorruptionSettings(conversationId: any): any {
  const stored = localStorage.getItem(`corruption_settings_${conversationId}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        positions: parsed.positions || DEFAULT_POSITIONS,
        keyLength: parsed.keyLength || DEFAULT_KEY_LENGTH
      };
    } catch (e) {
      console.error('Failed to parse corruption settings:', e);
    }
  }
  return {
    positions: DEFAULT_POSITIONS,
    keyLength: DEFAULT_KEY_LENGTH
  };
}

// Save corruption settings to localStorage
export function saveCorruptionSettings(conversationId: any, positions: any, keyLength: any): void {
  const settings = {
    positions: positions.filter(p => p > 0).sort((a, b) => a - b),
    keyLength: Math.max(1, Math.min(keyLength, 20)) // Limit between 1-20
  };
  localStorage.setItem(`corruption_settings_${conversationId}`, JSON.stringify(settings));
  return settings;
}

// Generate random corruption key of specified length
export function generateCorruptionKey(length: number = DEFAULT_KEY_LENGTH): any {
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let result = '';
  for (let i = 0; i < length; i++) {
    result += alphabet[randomBytes[i] & 63];
  }
  return result;
}

export function addConfiguredCorruption(
  encryptedMessage: string,
  positions: number[],
  keyLength: number,
  corruptionKeys: string[]
): string {
  const activePositions = positions
    .map((position, index) => ({ position, index }))
    .filter(({ position }) => position < encryptedMessage.length);
  let corruptedMessage = "";
  let lastIndex = 0;

  activePositions.forEach(({ position, index }) => {
    corruptedMessage += encryptedMessage.substring(lastIndex, position);
    corruptedMessage += corruptionKeys[index] || generateCorruptionKey(keyLength);
    lastIndex = position;
  });

  return corruptedMessage + encryptedMessage.substring(lastIndex);
}

export function removeConfiguredCorruption(
  corruptedMessage: string,
  positions: number[],
  keyLength: number
): string {
  let activeCount = -1;
  let originalLength = -1;

  for (let candidateCount = 0; candidateCount <= positions.length; candidateCount++) {
    const candidateLength = corruptedMessage.length - candidateCount * keyLength;
    const matchingCount = positions.filter((position) => position < candidateLength).length;
    if (matchingCount === candidateCount) {
      activeCount = candidateCount;
      originalLength = candidateLength;
      break;
    }
  }

  if (activeCount < 0 || originalLength < 0) {
    throw new Error("Corruption settings do not match this message");
  }

  const activePositions = positions.filter((position) => position < originalLength);
  let cleanMessage = "";
  let sourceIndex = 0;
  let corruptedIndex = 0;

  for (const position of activePositions) {
    const segmentLength = position - sourceIndex;
    cleanMessage += corruptedMessage.substring(
      corruptedIndex,
      corruptedIndex + segmentLength
    );
    corruptedIndex += segmentLength + keyLength;
    sourceIndex = position;
  }

  return cleanMessage + corruptedMessage.substring(corruptedIndex);
}

// Add corruption to encrypted message
export function addCorruption(encryptedMsg: any, conversationId: any): any {
  const { positions, keyLength } = getCorruptionSettings(conversationId);
  
  // Only use positions that are within the message length
  const validPositions = positions.filter(pos => pos < encryptedMsg.length);
  
  if (validPositions.length === 0) {
    return encryptedMsg;
  }
  
  let corruptedMessage = "";
  let lastIndex = 0;

  // Add segments with corruption keys
  validPositions.forEach((pos) => {
    corruptedMessage += encryptedMsg.substring(lastIndex, pos);
    const corruptionKey = generateCorruptionKey(keyLength);
    corruptedMessage += corruptionKey;
    lastIndex = pos;
  });
  
  corruptedMessage += encryptedMsg.substring(lastIndex);
  return corruptedMessage;
}

// Remove corruption from message
export function removeCorruption(corruptedMsg: any, conversationId: any): any {
  const { positions, keyLength } = getCorruptionSettings(conversationId);
  
  let cleanMessage = "";
  let currentIndex = 0;

  for (let i = 0; i < positions.length; i++) {
    const segmentLength = positions[i] - (i > 0 ? positions[i - 1] : 0);
    
    if (currentIndex + segmentLength > corruptedMsg.length) {
      cleanMessage += corruptedMsg.substring(currentIndex);
      break;
    }
    
    cleanMessage += corruptedMsg.substring(currentIndex, currentIndex + segmentLength);
    currentIndex += segmentLength;
    
    if (currentIndex + keyLength <= corruptedMsg.length) {
      currentIndex += keyLength;
    } else {
      break;
    }
  }
  
  if (currentIndex < corruptedMsg.length) {
    cleanMessage += corruptedMsg.substring(currentIndex);
  }

  return cleanMessage;
}
