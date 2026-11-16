import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import { Label } from "../../ui/label";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import {
  Download,
  HelpCircle,
  Save,
  Shuffle,
  Sparkles,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  generateV1Secret,
  exportV1SettingsBundle,
  getV1SenderSettings,
  importV1SettingsBundle,
  saveV1SenderSettings,
} from "@/utils/messageEncryptionV1";

type Props = {
  conversationId: string;
  currentUserId: string;
  otherUserId?: string;
};

const DEFAULT_POSITIONS = [5, 9, 15, 20, 30];
const outlineButtonClass =
  "border-blue-500/40 bg-blue-950/50 text-blue-100 hover:bg-blue-900/70 hover:text-white";

function randomPositions(count: number): number[] {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error("Choose between 1 and 100 positions");
  }
  const selected = new Set<number>();
  const range = Math.max(64, count);
  while (selected.size < count) {
    const bytes = crypto.getRandomValues(new Uint32Array(1));
    selected.add((bytes[0] % range) + 1);
  }
  return [...selected].sort((a, b) => a - b);
}

const CorruptionSettings = ({
  conversationId,
  currentUserId,
  otherUserId,
}: Props): JSX.Element => {
  const [senderId, setSenderId] = useState(currentUserId || "");
  const [configId, setConfigId] = useState("");
  const [key1, setKey1] = useState("");
  const [key2, setKey2] = useState("");
  const [positionsText, setPositionsText] = useState(
    DEFAULT_POSITIONS.join(", ")
  );
  const [positionCount, setPositionCount] = useState(DEFAULT_POSITIONS.length);
  const [keyLength, setKeyLength] = useState(4);
  const [showSecrets, setShowSecrets] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const isOwnSettings = useMemo(
    () => String(senderId) === String(currentUserId),
    [senderId, currentUserId]
  );

  useEffect(() => {
    setSenderId(currentUserId || "");
  }, [currentUserId]);

  useEffect(() => {
    if (!conversationId || !senderId) return;
    const settings = getV1SenderSettings(conversationId, senderId);
    setConfigId(settings?.configId || "");
    setKey1(settings?.key1 || "");
    setKey2(settings?.key2 || "");
    setPositionsText(settings?.positions.join(", ") || DEFAULT_POSITIONS.join(", "));
    setPositionCount(settings?.positions.length || DEFAULT_POSITIONS.length);
    setKeyLength(settings?.keyLength || 4);
  }, [conversationId, senderId]);

  const handleGeneratePositions = (): void => {
    try {
      const positions = randomPositions(Number(positionCount));
      setPositionsText(positions.join(", "));
      if (isOwnSettings) setConfigId("");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleGenerateSecrets = (): void => {
    setKey1(generateV1Secret());
    setKey2(generateV1Secret());
    setConfigId("");
  };

  const handleSave = (): void => {
    if (!conversationId || !senderId) {
      toast.error("Enter the sender's user ID first");
      return;
    }
    if (!isOwnSettings && !configId.trim()) {
      toast.error("Enter the sender's configuration ID");
      return;
    }

    const positions = positionsText
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
    if (positions.length !== Number(positionCount)) {
      toast.error("Position count must match the number of valid positions");
      return;
    }

    setIsSaving(true);
    try {
      const savedConfigId = saveV1SenderSettings(conversationId, senderId, {
        configId: configId.trim() || undefined,
        key1,
        key2,
        positions,
        keyLength: Number(keyLength),
      });
      setConfigId(savedConfigId);
      toast.success(
        isOwnSettings
          ? "Your V1 settings are saved. Share them out of band with participants."
          : "The other user's V1 settings are saved for decrypting their messages."
      );
    } catch (error: any) {
      toast.error(error.message || "Failed to save V1 settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = (): void => {
    try {
      const bundle = exportV1SettingsBundle(conversationId, senderId);
      const blob = new Blob([bundle], { type: "application/json" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeConversationId = conversationId.replace(/[^a-zA-Z0-9_-]/g, "_");
      const safeSenderId = senderId.replace(/[^a-zA-Z0-9_-]/g, "_");
      anchor.href = objectUrl;
      anchor.download = `v1-settings-${safeConversationId}-${safeSenderId}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (error: any) {
      toast.error(error.message || "Failed to export V1 settings");
    }
  };

  const handleImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const imported = importV1SettingsBundle(
        await file.text(),
        conversationId
      );
      setSenderId(imported.senderId);
      setConfigId(imported.settings.configId);
      setKey1(imported.settings.key1);
      setKey2(imported.settings.key2);
      setPositionsText(imported.settings.positions.join(", "));
      setPositionCount(imported.settings.positions.length);
      setKeyLength(imported.settings.keyLength);
      toast.success(`Imported settings for sender ${imported.senderId}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to import V1 settings");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-base text-white">V1 Two-Layer Secrets</CardTitle>
        <CardDescription className="text-gray-300">
          Configure secrets and corruption settings per message sender.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-900/20 border-blue-500/30">
          <HelpCircle className="h-4 w-4 text-blue-400" />
          <AlertTitle className="text-white">How this setting is used</AlertTitle>
          <AlertDescription className="text-sm text-gray-300">
            V1 encrypts with secret 1, inserts the configured random strings,
            then encrypts again with secret 2. Secrets and positions are stored
            only in this browser; exchange the sender's secrets, configuration
            ID, positions, and string length out of band.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label className="text-white">1. First encryption key (minimum 16 characters)</Label>
          <input
            type={showSecrets ? "text" : "password"}
            value={key1}
            onChange={(event) => {
              setKey1(event.target.value);
              if (isOwnSettings) setConfigId("");
            }}
            autoComplete="new-password"
            className="w-full p-2 bg-gray-900 text-gray-100 rounded-md border border-gray-700"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-white">2. Corruption settings</Label>
          <p className="text-xs text-gray-400">
            These random strings are inserted after the first encryption and before the second.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-white">Position count (1-100)</Label>
            <input
              type="number"
              min="1"
              max="100"
              value={positionCount}
              onChange={(event) => {
                setPositionCount(Number(event.target.value));
                if (isOwnSettings) setConfigId("");
              }}
              className="w-full p-2 bg-gray-900 text-gray-100 rounded-md border border-gray-700"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white">String length (1-64)</Label>
            <input
              type="number"
              min="1"
              max="64"
              value={keyLength}
              onChange={(event) => {
                setKeyLength(Number(event.target.value));
                if (isOwnSettings) setConfigId("");
              }}
              className="w-full p-2 bg-gray-900 text-gray-100 rounded-md border border-gray-700"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-white">Corruption positions</Label>
          <div className="flex flex-wrap gap-2">
            {positionsText.split(",").map((position, index) => (
              <input
                key={index}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={`Corruption position ${index + 1}`}
                value={position.trim()}
                onChange={(event) => {
                  const positions = positionsText.split(",");
                  positions[index] = event.target.value;
                  const value = positions.join(", ");
                  setPositionsText(value);
                  if (isOwnSettings) setConfigId("");
                  const count = value
                    .split(",")
                    .filter((item) => item.trim().length > 0).length;
                  setPositionCount(count);
                }}
                className="h-12 w-16 rounded-md border border-gray-700 bg-gray-900 text-center text-lg font-semibold text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGeneratePositions}
            className={outlineButtonClass}
          >
            <Shuffle className="h-4 w-4 mr-2" />
            Generate random positions
          </Button>
          <p className="text-xs text-gray-400">
            Positions beyond a message's encrypted text length are skipped.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-white">3. Second encryption key (minimum 16 characters)</Label>
          <input
            type={showSecrets ? "text" : "password"}
            value={key2}
            onChange={(event) => {
              setKey2(event.target.value);
              if (isOwnSettings) setConfigId("");
            }}
            autoComplete="new-password"
            className="w-full p-2 bg-gray-900 text-gray-100 rounded-md border border-gray-700"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setShowSecrets((visible) => !visible)}
            className={outlineButtonClass}
          >
            {showSecrets ? "Hide keys" : "Show keys"}
          </Button>
          <Button
            variant="outline"
            onClick={handleGenerateSecrets}
            disabled={!isOwnSettings}
            className={outlineButtonClass}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate two keys
          </Button>
        </div>

        <div className="space-y-2 border-t border-gray-700 pt-4">
          <Label className="text-white">4. Participant settings</Label>
          <p className="text-xs text-gray-400">
            Choose whose outgoing messages these keys and corruption settings belong to.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSenderId(currentUserId || "")}
              className={outlineButtonClass}
            >
              My settings
            </Button>
            {otherUserId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSenderId(otherUserId)}
                className={outlineButtonClass}
              >
                Other participant
              </Button>
            )}
          </div>
          <input
            type="text"
            value={senderId}
            onChange={(event) => setSenderId(event.target.value.trim())}
            placeholder="Enter sender user ID"
            className="w-full p-2 bg-gray-900 text-gray-100 rounded-md border border-gray-700"
          />
          <p className="text-xs text-gray-400">
            {isOwnSettings
              ? "These are your outgoing-message settings."
              : "Enter this sender's matching keys and settings to read their messages."}
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-white">Configuration ID</Label>
          <input
            type="text"
            value={configId}
            onChange={(event) => setConfigId(event.target.value.trim())}
            readOnly={isOwnSettings}
            placeholder={
              isOwnSettings
                ? "Generated when you save your settings"
                : "Enter the sender's configuration ID"
            }
            className="w-full p-2 bg-gray-900 text-gray-100 rounded-md border border-gray-700"
          />
          <p className="text-xs text-gray-400">
            Share this ID with the keys so recipients can select the right settings version.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save sender settings"}
        </Button>

        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImport}
        />
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!getV1SenderSettings(conversationId, senderId)}
            className={outlineButtonClass}
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => importInputRef.current?.click()}
            disabled={isImporting}
            className={outlineButtonClass}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isImporting ? "Importing..." : "Import JSON"}
          </Button>
        </div>

        <Alert className="bg-yellow-900/20 border-yellow-500/30">
          <AlertTitle className="text-yellow-400">Important</AlertTitle>
          <AlertDescription className="text-yellow-200 text-xs">
            The recipient must enter the sender's exact secrets, positions, and
            string length. Older configurations remain saved locally so older
            messages can still be decrypted when those settings are available.
            Exported JSON contains the encryption secrets; protect it like a
            password and share it only through a trusted channel.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default CorruptionSettings;
