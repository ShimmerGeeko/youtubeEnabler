"use client";

import { useEffect, useState } from "react";

type TopicStatus = "pending" | "approved" | "rejected";

type YouTubeVideo = {
  videoId: string;
  title: string;
  channelTitle: string;
  url: string;
};

type Topic = {
  id: string;
  title: string;
  description: string;
  source: string;
  youtubeVideos?: YouTubeVideo[];
  status: TopicStatus;
  createdAt: string;
};

type AnimationType =
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "slow-drift"
  | "shake"
  | "pulse";

type VideoScene = {
  id: number;
  durationSeconds: number;
  narration: string;
  visualPrompt: string;
  caption: string;
  animationType: AnimationType;
};

type GeneratedScript = {
  title: string;
  hook: string;
  script: string;
  estimatedDurationSeconds: number;
  scenes: VideoScene[];
};

type GeneratedVideo = {
  id: string;
  title: string;
  durationSeconds: number;
};

type YouTubeConnection = {
  configured: boolean;
  connected: boolean;
  channelTitle?: string | null;
};

type UploadedVideo = {
  videoId: string;
  url: string;
  privacyStatus: string;
};

const TOPICS_STORAGE_KEY = "ai-content-topics";
const SCRIPTS_STORAGE_KEY = "ai-content-generated-scripts";
const VIDEOS_STORAGE_KEY = "ai-content-generated-videos";
const UPLOADED_VIDEOS_STORAGE_KEY = "ai-content-youtube-uploads";

const animationTypes: AnimationType[] = [
  "zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "slow-drift",
  "shake",
  "pulse",
];

function normalizeGeneratedScript(
  value: unknown
): GeneratedScript | null {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const script = value as Record<string, unknown>;
  if (
    typeof script.title !== "string" ||
    typeof script.hook !== "string" ||
    typeof script.script !== "string"
  ) {
    return null;
  }

  const scenes = Array.isArray(script.scenes)
    ? script.scenes.flatMap((scene, index): VideoScene[] => {
        if (
          scene === null ||
          typeof scene !== "object" ||
          Array.isArray(scene)
        ) {
          return [];
        }

        const item = scene as Record<string, unknown>;
        const animationType =
          typeof item.animationType === "string" &&
          animationTypes.includes(item.animationType as AnimationType)
            ? (item.animationType as AnimationType)
            : "slow-drift";

        return [{
          id: Number(item.id) || index + 1,
          durationSeconds: Number(item.durationSeconds) || 7,
          narration:
            typeof item.narration === "string" ? item.narration : "",
          visualPrompt:
            typeof item.visualPrompt === "string" ? item.visualPrompt : "",
          caption: typeof item.caption === "string" ? item.caption : "",
          animationType,
        }];
      })
    : [];

  const legacyDurationSeconds = Number(script.estimatedDurationMinutes) * 60;
  const wordCount = script.script.trim().split(/\s+/).filter(Boolean).length;
  const durationSeconds =
    Number(script.estimatedDurationSeconds) ||
    legacyDurationSeconds ||
    scenes.reduce((total, scene) => total + scene.durationSeconds, 0) ||
    Math.max(1, Math.ceil(wordCount / 2.5));

  return {
    title: script.title,
    hook: script.hook,
    script: script.script,
    estimatedDurationSeconds: durationSeconds,
    scenes:
      scenes.length > 0
        ? scenes
        : [{
            id: 1,
            durationSeconds,
            narration: script.script,
            visualPrompt: `Documentary visuals for ${script.title}`,
            caption: script.hook,
            animationType: "slow-drift",
          }],
  };
}

const initialSections: Record<TopicStatus, boolean> = {
  pending: true,
  approved: true,
  rejected: false,
};

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>([]);

  const [generatedScripts, setGeneratedScripts] = useState<
    Record<string, GeneratedScript>
  >({});

  const [generatedVideos, setGeneratedVideos] = useState<
    Record<string, GeneratedVideo>
  >({});

  const [uploadedVideos, setUploadedVideos] = useState<
    Record<string, UploadedVideo>
  >({});

  const [hydrated, setHydrated] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const [renderingVideoFor, setRenderingVideoFor] = useState<string | null>(
    null
  );

  const [uploadingVideoFor, setUploadingVideoFor] = useState<string | null>(
    null
  );

  const [youtubeConnection, setYouTubeConnection] =
    useState<YouTubeConnection>({
      configured: false,
      connected: false,
    });

  const [youtubePrivacy, setYouTubePrivacy] = useState<
    "private" | "unlisted" | "public"
  >("private");

  const [youtubeMessage, setYouTubeMessage] = useState("");

  const [generatingScriptFor, setGeneratingScriptFor] = useState<string | null>(
    null
  );

  const [topicError, setTopicError] = useState("");
  const [scriptErrors, setScriptErrors] = useState<Record<string, string>>({});
  const [videoErrors, setVideoErrors] = useState<Record<string, string>>({});

  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

  const [sectionsOpen, setSectionsOpen] = useState(initialSections);

  // --------------------------------------------------
  // Restore saved data
  // --------------------------------------------------

  useEffect(() => {
    try {
      const savedTopics = localStorage.getItem(TOPICS_STORAGE_KEY);
      const savedScripts = localStorage.getItem(SCRIPTS_STORAGE_KEY);
      const savedVideos = localStorage.getItem(VIDEOS_STORAGE_KEY);
      const savedUploads = localStorage.getItem(
        UPLOADED_VIDEOS_STORAGE_KEY
      );

      if (savedTopics) {
        const parsedTopics: unknown = JSON.parse(savedTopics);

        if (Array.isArray(parsedTopics)) {
          setTopics(parsedTopics as Topic[]);
        }
      }

      if (savedScripts) {
        const parsedScripts: unknown = JSON.parse(savedScripts);

        if (
          parsedScripts !== null &&
          typeof parsedScripts === "object" &&
          !Array.isArray(parsedScripts)
        ) {
          const restoredScripts = Object.fromEntries(
            Object.entries(parsedScripts as Record<string, unknown>).flatMap(
              ([id, value]) => {
                const script = normalizeGeneratedScript(value);
                return script ? [[id, script]] : [];
              }
            )
          );
          setGeneratedScripts(restoredScripts);
        }
      }

      if (savedVideos) {
        const parsedVideos: unknown = JSON.parse(savedVideos);

        if (
          parsedVideos !== null &&
          typeof parsedVideos === "object" &&
          !Array.isArray(parsedVideos)
        ) {
          setGeneratedVideos(
            parsedVideos as Record<string, GeneratedVideo>
          );
        }
      }

      if (savedUploads) {
        const parsedUploads: unknown = JSON.parse(savedUploads);

        if (
          parsedUploads !== null &&
          typeof parsedUploads === "object" &&
          !Array.isArray(parsedUploads)
        ) {
          setUploadedVideos(
            parsedUploads as Record<string, UploadedVideo>
          );
        }
      }
    } catch (error) {
      console.error("Failed to restore saved data:", error);
    } finally {
      setHydrated(true);
    }
  }, []);

  // --------------------------------------------------
  // Persist topics
  // --------------------------------------------------

  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(
        TOPICS_STORAGE_KEY,
        JSON.stringify(topics)
      );
    } catch (error) {
      console.error("Failed to save topics:", error);

      setTopicError(
        "Could not save topics in this browser. Check available storage."
      );
    }
  }, [topics, hydrated]);

  // --------------------------------------------------
  // Persist scripts
  // --------------------------------------------------

  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(
        SCRIPTS_STORAGE_KEY,
        JSON.stringify(generatedScripts)
      );
    } catch (error) {
      console.error("Failed to save scripts:", error);

      setScriptErrors((current) => ({
        ...current,
        storage:
          "Could not save scripts in this browser. Check available storage.",
      }));
    }
  }, [generatedScripts, hydrated]);

  // --------------------------------------------------
  // Persist videos
  // --------------------------------------------------

  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(
        VIDEOS_STORAGE_KEY,
        JSON.stringify(generatedVideos)
      );
    } catch (error) {
      console.error("Failed to save rendered videos:", error);

      setVideoErrors((current) => ({
        ...current,
        storage: "Could not save video details in this browser.",
      }));
    }
  }, [generatedVideos, hydrated]);

  // --------------------------------------------------
  // Persist YouTube uploads
  // --------------------------------------------------

  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(
        UPLOADED_VIDEOS_STORAGE_KEY,
        JSON.stringify(uploadedVideos)
      );
    } catch (error) {
      console.error("Failed to save YouTube upload details:", error);

      setVideoErrors((current) => ({
        ...current,
        storage: "Could not save YouTube upload details in this browser.",
      }));
    }
  }, [uploadedVideos, hydrated]);

  // --------------------------------------------------
  // Check YouTube connection
  // --------------------------------------------------

  useEffect(() => {
    if (!hydrated) return;

    let active = true;

    async function checkYouTubeConnection() {
      try {
        const response = await fetch("/api/youtube/status", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = await response.json();

        if (active) {
          setYouTubeConnection({
            configured: Boolean(data?.configured),
            connected: Boolean(data?.connected),
            channelTitle: data?.channelTitle ?? null,
          });
        }
      } catch (error) {
        console.error(
          "Failed to check YouTube connection:",
          error
        );
      }
    }

    checkYouTubeConnection();

    const query = new URLSearchParams(window.location.search);
    const connectionResult = query.get("youtube");

    if (connectionResult === "connected") {
      setYouTubeMessage("YouTube channel connected.");
    } else if (connectionResult) {
      setYouTubeMessage(
        connectionResult === "not-configured"
          ? "Add YouTube OAuth settings to .env.local before connecting."
          : `YouTube connection result: ${connectionResult}`
      );
    }

    return () => {
      active = false;
    };
  }, [hydrated]);

  // --------------------------------------------------
  // Generate topics
  // --------------------------------------------------

  async function generateTopics() {
    setLoadingTopics(true);
    setTopicError("");

    try {
      const response = await fetch("/api/topics", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to generate topics."
        );
      }

      if (!Array.isArray(data)) {
        throw new Error(
          "The topic API did not return a list of topics."
        );
      }

      const newTopics: Topic[] = data.map(
        (topic: {
          title: string;
          description: string;
          source: string;
          youtubeVideos?: YouTubeVideo[];
        }) => ({
          id: crypto.randomUUID(),
          title: topic.title ?? "",
          description: topic.description ?? "",
          source: topic.source ?? "",
          youtubeVideos: Array.isArray(topic.youtubeVideos)
            ? topic.youtubeVideos
            : [],
          status: "pending",
          createdAt: new Date().toISOString(),
        })
      );

      setTopics((current) => [...newTopics, ...current]);
    } catch (error) {
      setTopicError(
        error instanceof Error
          ? error.message
          : "Something went wrong while generating topics."
      );
    } finally {
      setLoadingTopics(false);
    }
  }

  // --------------------------------------------------
  // Topic status
  // --------------------------------------------------

  function updateStatus(
    id: string,
    status: TopicStatus
  ) {
    setTopics((current) =>
      current.map((topic) =>
        topic.id === id
          ? { ...topic, status }
          : topic
      )
    );
  }

  // --------------------------------------------------
  // Edit topic
  // --------------------------------------------------

  function saveEdit() {
    if (!editingTopic) return;

    setTopics((current) =>
      current.map((topic) =>
        topic.id === editingTopic.id
          ? editingTopic
          : topic
      )
    );

    setEditingTopic(null);
  }

  // --------------------------------------------------
  // Extract generated script
  // --------------------------------------------------

  function extractScriptFromResponse(
    data: unknown
  ): GeneratedScript {
    function cleanJsonText(text: string) {
      return text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    }

    function parseJsonText(text: string): unknown {
      const cleaned = cleanJsonText(text);

      try {
        return JSON.parse(cleaned);
      } catch {
        console.error(
          "Failed to parse Gemini JSON:",
          cleaned
        );

        throw new Error(
          "The Script Agent returned invalid JSON."
        );
      }
    }

    function isScript(
      value: unknown
    ): value is Record<string, unknown> {
      if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value)
      ) {
        return false;
      }

      const object = value as Record<string, unknown>;

      return (
        typeof object.title === "string" &&
        typeof object.hook === "string" &&
        typeof object.script === "string"
      );
    }

    let parsed: unknown = data;

    // Direct JSON response
    if (!isScript(data)) {
      const object =
        data !== null &&
        typeof data === "object" &&
        !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : null;

      let text: string | null = null;

      if (typeof object?.output_text === "string") {
        text = object.output_text;
      }

      if (!text && Array.isArray(object?.steps)) {
        for (const step of object.steps) {
          if (
            step !== null &&
            typeof step === "object" &&
            Array.isArray(
              (step as Record<string, unknown>).content
            )
          ) {
            const content = (
              step as Record<string, unknown>
            ).content as unknown[];

            const textPart = content.find((item) => {
              if (
                item === null ||
                typeof item !== "object"
              ) {
                return false;
              }

              const itemObject =
                item as Record<string, unknown>;

              return (
                itemObject.type === "text" &&
                typeof itemObject.text === "string"
              );
            });

            if (textPart) {
              text =
                (textPart as Record<string, unknown>)
                  .text as string;
              break;
            }
          }
        }
      }

      if (!text) {
        const legacyObject = object;

        if (
          Array.isArray(legacyObject?.outputs) &&
          legacyObject.outputs.length > 0
        ) {
          const firstOutput =
            legacyObject.outputs[0];

          if (
            firstOutput !== null &&
            typeof firstOutput === "object"
          ) {
            const outputText = (
              firstOutput as Record<string, unknown>
            ).text;

            if (typeof outputText === "string") {
              text = outputText;
            }
          }
        }
      }

      if (!text) {
        throw new Error(
          "Script Agent response did not contain generated text."
        );
      }

      parsed = parseJsonText(text);
    }

    if (!isScript(parsed)) {
      throw new Error(
        "Script Agent response is missing title, hook or script."
      );
    }

    const normalizedScript = normalizeGeneratedScript(parsed);
    if (!normalizedScript) {
      throw new Error(
        "Script Agent response is missing title, hook or script."
      );
    }

    return normalizedScript;
  }

  // --------------------------------------------------
  // Generate script
  // --------------------------------------------------

  async function generateScript(topic: Topic) {
    if (topic.status !== "approved") {
      return;
    }

    setGeneratingScriptFor(topic.id);

    setScriptErrors((current) => {
      const next = { ...current };

      delete next[topic.id];
      delete next.storage;

      return next;
    });

    try {
      const response = await fetch("/api/scripts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: topic.title,
          description: topic.description,
          source: topic.source,
        }),
      });

      let data: unknown;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "The Script API returned an invalid response."
        );
      }

      if (!response.ok) {
        const errorObject =
          data !== null &&
          typeof data === "object" &&
          !Array.isArray(data)
            ? (data as Record<string, unknown>)
            : null;

        const errorMessage =
          typeof errorObject?.error === "string"
            ? errorObject.error
            : "Failed to generate the script.";

        throw new Error(errorMessage);
      }

      console.log(
        "Script Agent response:",
        data
      );

      const script =
        extractScriptFromResponse(data);

      setGeneratedScripts((current) => ({
        ...current,
        [topic.id]: script,
      }));
    } catch (error) {
      console.error(
        "Script generation error:",
        error
      );

      setScriptErrors((current) => ({
        ...current,
        [topic.id]:
          error instanceof Error
            ? error.message
            : "Something went wrong while generating the script.",
      }));
    } finally {
      setGeneratingScriptFor(null);
    }
  }

  // --------------------------------------------------
  // Render video
  // --------------------------------------------------

  async function renderVideo(topic: Topic) {
    const script = generatedScripts[topic.id];

    if (
      topic.status !== "approved" ||
      !script
    ) {
      return;
    }

    setRenderingVideoFor(topic.id);

    setVideoErrors((current) => {
      const next = { ...current };

      delete next[topic.id];
      delete next.storage;

      return next;
    });

    try {
      const response = await fetch(
        "/api/media/render",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            script,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to render the video."
        );
      }

      setGeneratedVideos((current) => ({
        ...current,
        [topic.id]:
          data as GeneratedVideo,
      }));
    } catch (error) {
      setVideoErrors((current) => ({
        ...current,
        [topic.id]:
          error instanceof Error
            ? error.message
            : "Something went wrong while rendering the video.",
      }));
    } finally {
      setRenderingVideoFor(null);
    }
  }

  // --------------------------------------------------
  // YouTube disconnect
  // --------------------------------------------------

  async function disconnectYouTube() {
    try {
      await fetch(
        "/api/youtube/disconnect",
        {
          method: "POST",
        }
      );

      setYouTubeConnection(
        (current) => ({
          ...current,
          connected: false,
          channelTitle: null,
        })
      );

      setYouTubeMessage(
        "YouTube channel disconnected."
      );
    } catch (error) {
      console.error(
        "Failed to disconnect YouTube:",
        error
      );
    }
  }

  // --------------------------------------------------
  // YouTube upload
  // --------------------------------------------------

  async function uploadVideo(topic: Topic) {
    const video =
      generatedVideos[topic.id];

    const script =
      generatedScripts[topic.id];

    if (
      topic.status !== "approved" ||
      !video ||
      !script ||
      !youtubeConnection.connected
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Upload "${script.title}" to ${
          youtubeConnection.channelTitle ||
          "your YouTube channel"
        } as ${youtubePrivacy.toUpperCase()}?`
      );

    if (!confirmed) return;

    setUploadingVideoFor(topic.id);

    setVideoErrors((current) => {
      const next = { ...current };

      delete next[topic.id];

      return next;
    });

    try {
      const response = await fetch(
        "/api/youtube/upload",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            mediaId: video.id,
            title: script.title,
            description: `${script.hook}\n\n${topic.description}\n\nGenerated with AI Content Studio.`,
            privacyStatus:
              youtubePrivacy,
            confirmed: true,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "YouTube upload failed."
        );
      }

      setUploadedVideos(
        (current) => ({
          ...current,
          [topic.id]:
            data as UploadedVideo,
        })
      );

      setYouTubeMessage(
        `Uploaded "${script.title}" to YouTube.`
      );
    } catch (error) {
      setVideoErrors(
        (current) => ({
          ...current,
          [topic.id]:
            error instanceof Error
              ? error.message
              : "YouTube upload failed.",
        })
      );
    } finally {
      setUploadingVideoFor(null);
    }
  }

  // --------------------------------------------------
  // Clear everything
  // --------------------------------------------------

  function clearTopics() {
    const confirmed =
      window.confirm(
        "Clear topics and saved scripts/video links from this browser? Rendered files on this server and YouTube uploads will not be deleted."
      );

    if (!confirmed) return;

    setTopics([]);
    setGeneratedScripts({});
    setGeneratedVideos({});
    setUploadedVideos({});
    setScriptErrors({});
    setVideoErrors({});
    setTopicError("");
  }

  function toggleSection(
    status: TopicStatus
  ) {
    setSectionsOpen((current) => ({
      ...current,
      [status]:
        !current[status],
    }));
  }

  // --------------------------------------------------
  // Topic Card
  // --------------------------------------------------

  function renderTopicCard(
    topic: Topic,
    index: number
  ) {
    const script =
      generatedScripts[topic.id];

    const video =
      generatedVideos[topic.id];

    const uploadedVideo =
      uploadedVideos[topic.id];

    const isGenerating =
      generatingScriptFor ===
      topic.id;

    const isRendering =
      renderingVideoFor ===
      topic.id;

    const isUploading =
      uploadingVideoFor ===
      topic.id;

    return (
      <article
        key={topic.id}
        style={{
          background: "#fff",
          border:
            "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 22,
          minWidth: 0,
          boxShadow:
            "0 2px 6px rgba(0,0,0,0.04)",
        }}
      >
        {/* Topic header */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={mutedText}>
            Topic {index + 1}
          </span>

          <span
            style={{
              ...statusBadge,
              background:
                topic.status ===
                "approved"
                  ? "#dcfce7"
                  : topic.status ===
                    "rejected"
                  ? "#fee2e2"
                  : "#f3f4f6",
              color:
                topic.status ===
                "approved"
                  ? "#166534"
                  : topic.status ===
                    "rejected"
                  ? "#991b1b"
                  : "#374151",
            }}
          >
            {topic.status}
          </span>
        </div>

        <h3
          style={{
            fontSize: 19,
            lineHeight: 1.4,
            margin:
              "14px 0 10px",
            overflowWrap:
              "anywhere",
          }}
        >
          {topic.title}
        </h3>

        <p style={descriptionText}>
          {topic.description}
        </p>

        <p
          style={{
            ...mutedText,
            marginTop: 16,
            overflowWrap:
              "anywhere",
          }}
        >
          Source:{" "}
          {topic.source ||
            "Not specified"}
        </p>

        {/* Topic actions */}

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 18,
          }}
        >
          <button
            onClick={() =>
              setEditingTopic({
                ...topic,
              })
            }
            style={
              secondaryButton
            }
          >
            Edit
          </button>

          {topic.status !==
            "approved" && (
            <button
              onClick={() =>
                updateStatus(
                  topic.id,
                  "approved"
                )
              }
              style={
                primaryButton
              }
            >
              Approve
            </button>
          )}

          {topic.status !==
            "rejected" && (
            <button
              onClick={() =>
                updateStatus(
                  topic.id,
                  "rejected"
                )
              }
              style={
                secondaryButton
              }
            >
              Reject
            </button>
          )}
        </div>

        {/* Script area */}

        {topic.status ===
          "approved" && (
          <div
            style={{
              marginTop: 20,
            }}
          >
            <button
              onClick={() =>
                generateScript(
                  topic
                )
              }
              disabled={isGenerating}
              style={{
                ...primaryButton,
                opacity:
                  isGenerating
                    ? 0.6
                    : 1,
                cursor:
                  isGenerating
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {isGenerating
                ? "Generating Script..."
                : script
                ? "Regenerate Script"
                : "Generate Script"}
            </button>

            {scriptErrors[
              topic.id
            ] && (
              <p
                style={
                  errorText
                }
              >
                {
                  scriptErrors[
                    topic.id
                  ]
                }
              </p>
            )}

            {script && (
              <div
                style={{
                  marginTop: 18,
                  padding: 18,
                  border:
                    "1px solid #e5e7eb",
                  borderRadius: 10,
                  background:
                    "#f9fafb",
                }}
              >
                {/* Script title */}

                <h4
                  style={{
                    fontSize: 20,
                    margin:
                      "0 0 8px",
                    lineHeight: 1.4,
                  }}
                >
                  {script.title}
                </h4>

                {/* Duration */}

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap:
                      "wrap",
                    marginBottom:
                      18,
                  }}
                >
                  <span
                    style={{
                      ...statusBadge,
                      background:
                        "#dbeafe",
                      color:
                        "#1e40af",
                    }}
                  >
                    {Math.round(
                      script.estimatedDurationSeconds
                    )}
                    s
                  </span>

                  <span
                    style={{
                      ...statusBadge,
                      background:
                        "#ede9fe",
                      color:
                        "#6d28d9",
                    }}
                  >
                    {script.scenes.length}{" "}
                    scenes
                  </span>

                  <span
                    style={{
                      ...statusBadge,
                      background:
                        "#fef3c7",
                      color:
                        "#92400e",
                    }}
                  >
                    YouTube Short
                  </span>
                </div>

                {/* Hook */}

                <h5
                  style={
                    subheading
                  }
                >
                  Opening Hook
                </h5>

                <div
                  style={{
                    padding: 12,
                    background:
                      "#fff",
                    border:
                      "1px solid #e5e7eb",
                    borderRadius: 8,
                    lineHeight: 1.7,
                  }}
                >
                  {script.hook}
                </div>

                {/* Full narration */}

                <h5
                  style={
                    subheading
                  }
                >
                  Full Narration
                </h5>

                <div
                  style={{
                    whiteSpace:
                      "pre-wrap",
                    overflowWrap:
                      "anywhere",
                    lineHeight: 1.8,
                    fontSize: 14,
                    color:
                      "#374151",
                    maxHeight: 300,
                    overflowY:
                      "auto",
                    padding: 12,
                    background:
                      "#fff",
                    border:
                      "1px solid #e5e7eb",
                    borderRadius: 8,
                  }}
                >
                  {script.script}
                </div>

                {/* Scenes */}

                <h5
                  style={{
                    ...subheading,
                    marginTop:
                      26,
                  }}
                >
                  Scenes
                </h5>

                <div
                  style={{
                    display:
                      "flex",
                    flexDirection:
                      "column",
                    gap: 14,
                  }}
                >
                  {script.scenes.map(
                    (scene) => (
                      <div
                        key={
                          scene.id
                        }
                        style={{
                          background:
                            "#fff",
                          border:
                            "1px solid #e5e7eb",
                          borderRadius:
                            10,
                          padding:
                            16,
                        }}
                      >
                        {/* Scene header */}

                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "center",
                            gap: 10,
                            flexWrap:
                              "wrap",
                            marginBottom:
                              12,
                          }}
                        >
                          <strong
                            style={{
                              fontSize:
                                15,
                            }}
                          >
                            Scene{" "}
                            {
                              scene.id
                            }
                          </strong>

                          <div
                            style={{
                              display:
                                "flex",
                              gap: 7,
                              flexWrap:
                                "wrap",
                            }}
                          >
                            <span
                              style={{
                                ...statusBadge,
                                background:
                                  "#f3f4f6",
                                color:
                                  "#374151",
                              }}
                            >
                              {
                                scene.durationSeconds
                              }
                              s
                            </span>

                            <span
                              style={{
                                ...statusBadge,
                                background:
                                  "#e0f2fe",
                                color:
                                  "#075985",
                              }}
                            >
                              {
                                scene.animationType
                              }
                            </span>
                          </div>
                        </div>

                        {/* Narration */}

                        <div
                          style={{
                            marginBottom:
                              12,
                          }}
                        >
                          <div
                            style={
                              fieldLabel
                            }
                          >
                            Narration
                          </div>

                          <div
                            style={
                              sceneBox
                            }
                          >
                            {
                              scene.narration
                            }
                          </div>
                        </div>

                        {/* Visual prompt */}

                        <div
                          style={{
                            marginBottom:
                              12,
                          }}
                        >
                          <div
                            style={
                              fieldLabel
                            }
                          >
                            Visual Prompt
                          </div>

                          <div
                            style={
                              promptBox
                            }
                          >
                            {
                              scene.visualPrompt
                            }
                          </div>
                        </div>

                        {/* Caption */}

                        <div>
                          <div
                            style={
                              fieldLabel
                            }
                          >
                            Caption
                          </div>

                          <div
                            style={
                              captionBox
                            }
                          >
                            {
                              scene.caption
                            }
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* Rendering */}

                {videoErrors[
                  topic.id
                ] && (
                  <p
                    style={
                      errorText
                    }
                  >
                    {
                      videoErrors[
                        topic.id
                      ]
                    }
                  </p>
                )}

                <div
                  style={{
                    marginTop:
                      24,
                    paddingTop:
                      18,
                    borderTop:
                      "1px solid #e5e7eb",
                  }}
                >
                  <button
                    onClick={() =>
                      renderVideo(
                        topic
                      )
                    }
                    disabled={
                      isRendering
                    }
                    style={{
                      ...secondaryButton,
                      opacity:
                        isRendering
                          ? 0.6
                          : 1,
                      cursor:
                        isRendering
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {isRendering
                      ? "Rendering MP4..."
                      : video
                      ? "Render Again"
                      : "Render Video"}
                  </button>

                  {/* Video preview */}

                  {video && (
                    <div
                      style={{
                        marginTop:
                          16,
                      }}
                    >
                      <video
                        controls
                        preload="metadata"
                        src={`/api/media/${video.id}`}
                        style={{
                          display:
                            "block",
                          width:
                            "100%",
                          maxWidth:
                            420,
                          aspectRatio:
                            "9 / 16",
                          objectFit:
                            "contain",
                          background:
                            "#111827",
                          borderRadius:
                            10,
                        }}
                      />

                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          gap: 12,
                          flexWrap:
                            "wrap",
                          marginTop:
                            10,
                        }}
                      >
                        <span
                          style={
                            mutedText
                          }
                        >
                          {Math.floor(
                            video.durationSeconds /
                              60
                          )}
                          :
                          {String(
                            video.durationSeconds %
                              60
                          ).padStart(
                            2,
                            "0"
                          )}{" "}
                          video
                        </span>

                        <a
                          href={`/api/media/${video.id}`}
                          download={`${video.title}.mp4`}
                          style={{
                            fontSize:
                              13,
                            color:
                              "#1d4ed8",
                          }}
                        >
                          Download MP4
                        </a>
                      </div>

                      {/* YouTube upload */}

                      {uploadedVideo ? (
                        <p
                          style={{
                            margin:
                              "12px 0 0",
                            fontSize:
                              13,
                          }}
                        >
                          Uploaded as{" "}
                          {
                            uploadedVideo.privacyStatus
                          }
                          .{" "}
                          <a
                            href={
                              uploadedVideo.url
                            }
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color:
                                "#1d4ed8",
                            }}
                          >
                            View on YouTube
                          </a>
                        </p>
                      ) : (
                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: 10,
                            flexWrap:
                              "wrap",
                            marginTop:
                              14,
                          }}
                        >
                          <label
                            htmlFor={`youtube-privacy-${topic.id}`}
                            style={
                              mutedText
                            }
                          >
                            Visibility
                          </label>

                          <select
                            id={`youtube-privacy-${topic.id}`}
                            value={
                              youtubePrivacy
                            }
                            onChange={(
                              event
                            ) =>
                              setYouTubePrivacy(
                                event
                                  .target
                                  .value as
                                  | "private"
                                  | "unlisted"
                                  | "public"
                              )
                            }
                            disabled={
                              !youtubeConnection.connected ||
                              isUploading
                            }
                            style={{
                              padding:
                                "8px 10px",
                              border:
                                "1px solid #d1d5db",
                              borderRadius:
                                7,
                            }}
                          >
                            <option value="private">
                              Private
                            </option>

                            <option value="unlisted">
                              Unlisted
                            </option>

                            <option value="public">
                              Public
                            </option>
                          </select>

                          {!youtubeConnection.connected ? (
                            <a
                              href="/api/youtube/connect"
                              style={
                                primaryButton
                              }
                            >
                              Connect YouTube
                            </a>
                          ) : (
                            <button
                              onClick={() =>
                                uploadVideo(
                                  topic
                                )
                              }
                              disabled={
                                isUploading
                              }
                              style={{
                                ...primaryButton,
                                opacity:
                                  isUploading
                                    ? 0.6
                                    : 1,
                              }}
                            >
                              {isUploading
                                ? "Uploading..."
                                : "Upload to YouTube"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </article>
    );
  }

  // --------------------------------------------------
  // Sections
  // --------------------------------------------------

  function renderSection(
    status: TopicStatus
  ) {
    const sectionTopics =
      topics.filter(
        (topic) =>
          topic.status ===
          status
      );

    const titles: Record<
      TopicStatus,
      string
    > = {
      pending:
        "Pending Review",
      approved:
        "Approved Topics",
      rejected:
        "Rejected Topics",
    };

    return (
      <section
        key={status}
        style={{
          marginBottom: 24,
          background: "#fff",
          border:
            "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <button
          onClick={() =>
            toggleSection(
              status
            )
          }
          aria-expanded={
            sectionsOpen[
              status
            ]
          }
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 12,
            width: "100%",
            padding:
              "20px 22px",
            background: "#fff",
            border: "none",
            cursor:
              "pointer",
            textAlign:
              "left",
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color:
                "#111827",
            }}
          >
            {titles[status]} (
            {
              sectionTopics.length
            }
            )
          </span>

          <span
            style={{
              color:
                "#6b7280",
              fontSize: 20,
            }}
          >
            {sectionsOpen[
              status
            ]
              ? "−"
              : "+"}
          </span>
        </button>

        {sectionsOpen[
          status
        ] && (
          <div
            style={{
              padding:
                "0 22px 22px",
            }}
          >
            {sectionTopics.length ===
            0 ? (
              <p
                style={{
                  color:
                    "#6b7280",
                  fontSize: 14,
                  padding:
                    "10px 0",
                }}
              >
                No {status} topics
                yet.
              </p>
            ) : (
              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
                  gap: 18,
                }}
              >
                {sectionTopics.map(
                  (
                    topic,
                    index
                  ) =>
                    renderTopicCard(
                      topic,
                      index
                    )
                )}
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (!hydrated) {
    return (
      <main
        style={
          pageStyle
        }
      >
        <p>
          Loading your
          saved topics
          and scripts...
        </p>
      </main>
    );
  }

  // --------------------------------------------------
  // Main UI
  // --------------------------------------------------

  return (
    <main
      style={
        pageStyle
      }
    >
      <div
        style={{
          maxWidth: 1250,
          margin:
            "0 auto",
        }}
      >
        <header
          style={{
            marginBottom:
              30,
          }}
        >
          <h1
            style={{
              fontSize: 34,
              lineHeight:
                1.2,
              margin:
                "0 0 10px",
              color:
                "#111827",
            }}
          >
            AI Content Studio
          </h1>

          <p
            style={{
              color:
                "#6b7280",
              margin: 0,
              lineHeight:
                1.6,
            }}
          >
            Topic → Short
            script → scenes
            → visuals → voice
            → captions → final
            video.
          </p>
        </header>

        {/* Controls */}

        <div
          style={{
            display:
              "flex",
            gap: 12,
            flexWrap:
              "wrap",
            marginBottom:
              24,
          }}
        >
          <button
            onClick={
              generateTopics
            }
            disabled={
              loadingTopics
            }
            style={{
              ...primaryButton,
              opacity:
                loadingTopics
                  ? 0.6
                  : 1,
              cursor:
                loadingTopics
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {loadingTopics
              ? "Generating Topics..."
              : "Generate Topics"}
          </button>

          {topics.length >
            0 && (
            <button
              onClick={
                clearTopics
              }
              style={
                secondaryButton
              }
            >
              Clear All Topics
            </button>
          )}
        </div>

        {topicError && (
          <p
            style={
              errorText
            }
          >
            {topicError}
          </p>
        )}

        {youtubeMessage && (
          <div
            style={{
              marginBottom:
                20,
              padding:
                "10px 14px",
              borderRadius:
                8,
              background:
                "#eff6ff",
              color:
                "#1e40af",
              fontSize: 14,
            }}
          >
            {youtubeMessage}

            {youtubeConnection.connected && (
              <button
                onClick={
                  disconnectYouTube
                }
                style={{
                  marginLeft:
                    12,
                  border:
                    "none",
                  background:
                    "transparent",
                  color:
                    "#1d4ed8",
                  cursor:
                    "pointer",
                  textDecoration:
                    "underline",
                }}
              >
                Disconnect
              </button>
            )}
          </div>
        )}

        {/* Summary */}

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 12,
            marginBottom:
              28,
          }}
        >
          {(
            [
              "pending",
              "approved",
              "rejected",
            ] as TopicStatus[]
          ).map(
            (status) => (
              <div
                key={
                  status
                }
                style={
                  summaryCard
                }
              >
                <p
                  style={{
                    ...mutedText,
                    textTransform:
                      "capitalize",
                    margin:
                      "0 0 8px",
                  }}
                >
                  {status}
                </p>

                <strong
                  style={{
                    fontSize: 26,
                    color:
                      "#111827",
                  }}
                >
                  {
                    topics.filter(
                      (
                        topic
                      ) =>
                        topic.status ===
                        status
                    ).length
                  }
                </strong>
              </div>
            )
          )}
        </div>

        {topics.length ===
        0 ? (
          <div
            style={{
              padding: 44,
              background:
                "#fff",
              border:
                "1px dashed #d1d5db",
              borderRadius:
                12,
              textAlign:
                "center",
            }}
          >
            <h2
              style={{
                fontSize: 20,
                margin:
                  "0 0 10px",
              }}
            >
              No topics yet
            </h2>

            <p
              style={{
                color:
                  "#6b7280",
                margin: 0,
                lineHeight:
                  1.6,
              }}
            >
              Click Generate
              Topics to start
              your content
              production
              workflow.
            </p>
          </div>
        ) : (
          <>
            {renderSection(
              "pending"
            )}

            {renderSection(
              "approved"
            )}

            {renderSection(
              "rejected"
            )}
          </>
        )}
      </div>

      {/* --------------------------------------------------
          Edit Topic Modal
      -------------------------------------------------- */}

      {editingTopic && (
        <div
          role="presentation"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setEditingTopic(
                null
              );
            }
          }}
          style={{
            position:
              "fixed",
            inset: 0,
            zIndex: 1000,
            background:
              "rgba(17, 24, 39, 0.55)",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: 20,
            overflowY:
              "auto",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-topic-heading"
            style={{
              width:
                "100%",
              maxWidth:
                620,
              background:
                "#fff",
              borderRadius:
                14,
              padding:
                26,
              boxSizing:
                "border-box",
              margin:
                "auto",
            }}
          >
            <h2
              id="edit-topic-heading"
              style={{
                fontSize: 23,
                margin:
                  "0 0 22px",
              }}
            >
              Edit Topic
            </h2>

            <form
              onSubmit={(
                event
              ) => {
                event.preventDefault();
                saveEdit();
              }}
            >
              <label
                htmlFor="topic-title"
                style={
                  labelStyle
                }
              >
                Title
              </label>

              <input
                id="topic-title"
                required
                value={
                  editingTopic.title
                }
                onChange={(
                  event
                ) =>
                  setEditingTopic(
                    {
                      ...editingTopic,
                      title:
                        event.target
                          .value,
                    }
                  )
                }
                style={
                  inputStyle
                }
              />

              <label
                htmlFor="topic-description"
                style={
                  labelStyle
                }
              >
                Description
              </label>

              <textarea
                id="topic-description"
                required
                rows={5}
                value={
                  editingTopic.description
                }
                onChange={(
                  event
                ) =>
                  setEditingTopic(
                    {
                      ...editingTopic,
                      description:
                        event.target
                          .value,
                    }
                  )
                }
                style={{
                  ...inputStyle,
                  resize:
                    "vertical",
                  fontFamily:
                    "inherit",
                }}
              />

              <label
                htmlFor="topic-source"
                style={
                  labelStyle
                }
              >
                Source
              </label>

              <input
                id="topic-source"
                value={
                  editingTopic.source
                }
                onChange={(
                  event
                ) =>
                  setEditingTopic(
                    {
                      ...editingTopic,
                      source:
                        event.target
                          .value,
                    }
                  )
                }
                style={
                  inputStyle
                }
              />

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  gap: 10,
                  flexWrap:
                    "wrap",
                  marginTop:
                    24,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setEditingTopic(
                      null
                    )
                  }
                  style={
                    secondaryButton
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={
                    primaryButton
                  }
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

// --------------------------------------------------
// Styles
// --------------------------------------------------

const pageStyle: React.CSSProperties =
  {
    minHeight:
      "100vh",
    padding:
      "40px 24px",
    background:
      "#f7f8fa",
    fontFamily:
      "Arial, Helvetica, sans-serif",
    color:
      "#111827",
    boxSizing:
      "border-box",
  };

const primaryButton: React.CSSProperties =
  {
    padding:
      "11px 16px",
    borderRadius: 8,
    border:
      "1px solid #111827",
    background:
      "#111827",
    color:
      "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor:
      "pointer",
  };

const secondaryButton: React.CSSProperties =
  {
    padding:
      "10px 15px",
    borderRadius: 8,
    border:
      "1px solid #d1d5db",
    background:
      "#fff",
    color:
      "#374151",
    fontSize: 14,
    fontWeight: 500,
    cursor:
      "pointer",
  };

const mutedText: React.CSSProperties =
  {
    fontSize: 13,
    color:
      "#6b7280",
  };

const descriptionText: React.CSSProperties =
  {
    fontSize: 14,
    lineHeight: 1.7,
    color:
      "#4b5563",
    overflowWrap:
      "anywhere",
  };

const statusBadge: React.CSSProperties =
  {
    display:
      "inline-block",
    padding:
      "5px 9px",
    borderRadius:
      20,
    fontSize: 11,
    fontWeight: 700,
    textTransform:
      "uppercase",
  };

const summaryCard: React.CSSProperties =
  {
    background:
      "#fff",
    border:
      "1px solid #e5e7eb",
    borderRadius:
      10,
    padding: 18,
  };

const errorText: React.CSSProperties =
  {
    color:
      "#b91c1c",
    fontSize: 14,
    lineHeight: 1.6,
    overflowWrap:
      "anywhere",
  };

const subheading: React.CSSProperties =
  {
    fontSize: 15,
    margin:
      "20px 0 8px",
    color:
      "#111827",
  };

const fieldLabel: React.CSSProperties =
  {
    fontSize: 12,
    fontWeight: 700,
    color:
      "#6b7280",
    textTransform:
      "uppercase",
    marginBottom:
      5,
  };

const sceneBox: React.CSSProperties =
  {
    padding: 11,
    border:
      "1px solid #e5e7eb",
    borderRadius: 7,
    background:
      "#f9fafb",
    fontSize: 14,
    lineHeight: 1.6,
    color:
      "#374151",
    whiteSpace:
      "pre-wrap",
    overflowWrap:
      "anywhere",
  };

const promptBox: React.CSSProperties =
  {
    padding: 11,
    border:
      "1px solid #bfdbfe",
    borderRadius: 7,
    background:
      "#eff6ff",
    fontSize: 13,
    lineHeight: 1.6,
    color:
      "#1e3a8a",
    whiteSpace:
      "pre-wrap",
    overflowWrap:
      "anywhere",
  };

const captionBox: React.CSSProperties =
  {
    padding: 11,
    border:
      "1px solid #ddd6fe",
    borderRadius: 7,
    background:
      "#f5f3ff",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.5,
    color:
      "#5b21b6",
    overflowWrap:
      "anywhere",
  };

const labelStyle: React.CSSProperties =
  {
    display:
      "block",
    fontSize: 14,
    fontWeight: 600,
    marginBottom:
      7,
    marginTop:
      16,
  };

const inputStyle: React.CSSProperties =
  {
    display:
      "block",
    width:
      "100%",
    boxSizing:
      "border-box",
    padding:
      "11px 12px",
    border:
      "1px solid #d1d5db",
    borderRadius: 7,
    fontSize: 14,
    color:
      "#111827",
  };