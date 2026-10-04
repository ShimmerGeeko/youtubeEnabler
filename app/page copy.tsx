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

type GeneratedScript = {
  title: string;
  hook: string;
  script: string;
  estimatedDurationMinutes: number;
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
    useState<YouTubeConnection>({ configured: false, connected: false });
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

  useEffect(() => {
    try {
      const savedTopics = localStorage.getItem(TOPICS_STORAGE_KEY);
      const savedScripts = localStorage.getItem(SCRIPTS_STORAGE_KEY);
      const savedVideos = localStorage.getItem(VIDEOS_STORAGE_KEY);
      const savedUploads = localStorage.getItem(UPLOADED_VIDEOS_STORAGE_KEY);

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
          setGeneratedScripts(
            parsedScripts as Record<string, GeneratedScript>
          );
        }
      }

      if (savedVideos) {
        const parsedVideos: unknown = JSON.parse(savedVideos);

        if (
          parsedVideos !== null &&
          typeof parsedVideos === "object" &&
          !Array.isArray(parsedVideos)
        ) {
          setGeneratedVideos(parsedVideos as Record<string, GeneratedVideo>);
        }
      }

      if (savedUploads) {
        const parsedUploads: unknown = JSON.parse(savedUploads);

        if (
          parsedUploads !== null &&
          typeof parsedUploads === "object" &&
          !Array.isArray(parsedUploads)
        ) {
          setUploadedVideos(parsedUploads as Record<string, UploadedVideo>);
        }
      }
    } catch (error) {
      console.error("Failed to restore saved data:", error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(TOPICS_STORAGE_KEY, JSON.stringify(topics));
    } catch (error) {
      console.error("Failed to save topics:", error);

      setTopicError(
        "Could not save topics in this browser. Check available storage."
      );
    }
  }, [topics, hydrated]);

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

  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(VIDEOS_STORAGE_KEY, JSON.stringify(generatedVideos));
    } catch (error) {
      console.error("Failed to save rendered videos:", error);
      setVideoErrors((current) => ({
        ...current,
        storage: "Could not save video details in this browser.",
      }));
    }
  }, [generatedVideos, hydrated]);

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

  useEffect(() => {
    if (!hydrated) return;

    let active = true;
    const query = new URLSearchParams(window.location.search);
    const connectionResult = query.get("youtube");

    if (connectionResult === "connected") {
      setYouTubeMessage("YouTube channel connected.");
    } else if (connectionResult) {
      setYouTubeMessage(
        connectionResult === "not-configured"
          ? "Add YouTube OAuth settings to .env.local before connecting."
          : "YouTube authorization did not complete. Check your OAuth settings and try again."
      );
    }

    if (connectionResult) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    fetch("/api/youtube/status", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as YouTubeConnection;
        if (active) setYouTubeConnection(data);
      })
      .catch((error) => {
        console.error("Failed to check YouTube connection:", error);
      });

    return () => {
      active = false;
    };
  }, [hydrated]);

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
        throw new Error(data?.error || "Failed to generate topics.");
      }

      if (!Array.isArray(data)) {
        throw new Error("The topic API did not return a list of topics.");
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

  function updateStatus(id: string, status: TopicStatus) {
    setTopics((current) =>
      current.map((topic) =>
        topic.id === id ? { ...topic, status } : topic
      )
    );
  }

  function saveEdit() {
    if (!editingTopic) return;

    setTopics((current) =>
      current.map((topic) =>
        topic.id === editingTopic.id ? editingTopic : topic
      )
    );

    setEditingTopic(null);
  }

  /**
   * Extracts the GeneratedScript from different possible API response shapes.
   *
   * Supported formats:
   *
   * 1. Direct:
   * {
   *   title,
   *   hook,
   *   script,
   *   estimatedDurationMinutes
   * }
   *
   * 2. Gemini Interaction:
   * {
   *   steps: [
   *     {
   *       content: [
   *         {
   *           text: "{ ...JSON... }"
   *         }
   *       ]
   *     }
   *   ]
   * }
   *
   * 3. Legacy outputs[]:
   * {
   *   outputs: [
   *     {
   *       text: "{ ...JSON... }"
   *     }
   *   ]
   * }
   */
function extractScriptFromResponse(data: unknown): GeneratedScript {
  function cleanJsonText(text: string): string {
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
      throw new Error(
        "The Script Agent returned text, but it was not valid JSON."
      );
    }
  }

  function isScript(value: unknown): value is GeneratedScript {
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

  // --------------------------------------------------
  // 1. Direct response:
  // {
  //   title,
  //   hook,
  //   script,
  //   estimatedDurationMinutes
  // }
  // --------------------------------------------------

  if (isScript(data)) {
    const object = data as Record<string, unknown>;

    return {
      title: object.title as string,
      hook: object.hook as string,
      script: object.script as string,
      estimatedDurationMinutes:
        Number(object.estimatedDurationMinutes) || 8,
    };
  }

  // From this point onward we expect an object.
  if (
    data === null ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error("The Script Agent returned an invalid response.");
  }

  const response = data as Record<string, unknown>;

  // --------------------------------------------------
  // 2. EXACT GEMINI RESPONSE YOU POSTED
  //
  // steps[0].content[0].text
  // --------------------------------------------------

  if (Array.isArray(response.steps)) {
    for (const step of response.steps) {
      if (
        step === null ||
        typeof step !== "object" ||
        Array.isArray(step)
      ) {
        continue;
      }

      const stepObject = step as Record<string, unknown>;

      if (!Array.isArray(stepObject.content)) {
        continue;
      }

      for (const contentItem of stepObject.content) {
        if (
          contentItem === null ||
          typeof contentItem !== "object" ||
          Array.isArray(contentItem)
        ) {
          continue;
        }

        const contentObject =
          contentItem as Record<string, unknown>;

        if (typeof contentObject.text !== "string") {
          continue;
        }

        try {
          const parsed = parseJsonText(contentObject.text);

          if (isScript(parsed)) {
            const scriptObject =
              parsed as Record<string, unknown>;

            return {
              title: scriptObject.title as string,
              hook: scriptObject.hook as string,
              script: scriptObject.script as string,
              estimatedDurationMinutes:
                Number(scriptObject.estimatedDurationMinutes) || 8,
            };
          }
        } catch {
          // Continue checking other content items.
        }
      }
    }
  }

  // --------------------------------------------------
  // 3. Gemini output_text
  //
  // output_text is itself a JSON string
  // --------------------------------------------------

  if (typeof response.output_text === "string") {
    try {
      const parsed = parseJsonText(response.output_text);

      if (isScript(parsed)) {
        const scriptObject =
          parsed as Record<string, unknown>;

        return {
          title: scriptObject.title as string,
          hook: scriptObject.hook as string,
          script: scriptObject.script as string,
          estimatedDurationMinutes:
            Number(scriptObject.estimatedDurationMinutes) || 8,
        };
      }
    } catch {
      // Continue to legacy formats.
    }
  }

  // --------------------------------------------------
  // 4. Legacy outputs[]
  // --------------------------------------------------

  if (Array.isArray(response.outputs)) {
    for (const output of response.outputs) {
      if (
        output === null ||
        typeof output !== "object" ||
        Array.isArray(output)
      ) {
        continue;
      }

      const outputObject =
        output as Record<string, unknown>;

      if (typeof outputObject.text !== "string") {
        continue;
      }

      try {
        const parsed = parseJsonText(outputObject.text);

        if (isScript(parsed)) {
          const scriptObject =
            parsed as Record<string, unknown>;

          return {
            title: scriptObject.title as string,
            hook: scriptObject.hook as string,
            script: scriptObject.script as string,
            estimatedDurationMinutes:
              Number(scriptObject.estimatedDurationMinutes) || 8,
          };
        }
      } catch {
        // Continue.
      }
    }
  }

  // --------------------------------------------------
  // Nothing worked
  // --------------------------------------------------

  console.error(
    "Unable to extract script from Script Agent response:",
    data
  );

  throw new Error(
    "The Script Agent response was received, but the generated script could not be extracted."
  );
}


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
        throw new Error("The Script API returned an invalid response.");
      }

      if (!response.ok) {
        const errorObject =
          data !== null && typeof data === "object" && !Array.isArray(data)
            ? (data as Record<string, unknown>)
            : null;
        const errorMessage =
          typeof errorObject?.error === "string"
            ? errorObject.error
            : "Failed to generate the script.";

        throw new Error(errorMessage);
      }

      console.log("Script Agent response:", data);

      const script = extractScriptFromResponse(data);

      setGeneratedScripts((current) => ({
        ...current,
        [topic.id]: script,
      }));
    } catch (error) {
      console.error("Script generation error:", error);

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

  async function renderVideo(topic: Topic) {
    const script = generatedScripts[topic.id];
    if (topic.status !== "approved" || !script) return;

    setRenderingVideoFor(topic.id);
    setVideoErrors((current) => {
      const next = { ...current };
      delete next[topic.id];
      delete next.storage;
      return next;
    });

    try {
      const response = await fetch("/api/media/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to render the video.");
      }

      setGeneratedVideos((current) => ({
        ...current,
        [topic.id]: data as GeneratedVideo,
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

  async function disconnectYouTube() {
    await fetch("/api/youtube/disconnect", { method: "POST" });
    setYouTubeConnection((current) => ({ ...current, connected: false }));
    setYouTubeMessage("YouTube channel disconnected.");
  }

  async function uploadVideo(topic: Topic) {
    const video = generatedVideos[topic.id];
    const script = generatedScripts[topic.id];

    if (
      topic.status !== "approved" ||
      !video ||
      !script ||
      !youtubeConnection.connected
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Upload "${script.title}" to ${youtubeConnection.channelTitle || "your YouTube channel"} as ${youtubePrivacy.toUpperCase()}?`
    );
    if (!confirmed) return;

    setUploadingVideoFor(topic.id);
    setVideoErrors((current) => {
      const next = { ...current };
      delete next[topic.id];
      return next;
    });

    try {
      const response = await fetch("/api/youtube/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: video.id,
          title: script.title,
          description: `${script.hook}\n\n${topic.description}\n\nGenerated with AI Content Studio.`,
          privacyStatus: youtubePrivacy,
          confirmed: true,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "YouTube upload failed.");
      }

      setUploadedVideos((current) => ({
        ...current,
        [topic.id]: data as UploadedVideo,
      }));
      setYouTubeMessage(`Uploaded "${script.title}" to YouTube.`);
    } catch (error) {
      setVideoErrors((current) => ({
        ...current,
        [topic.id]:
          error instanceof Error ? error.message : "YouTube upload failed.",
      }));
    } finally {
      setUploadingVideoFor(null);
    }
  }

  function clearTopics() {
    const confirmed = window.confirm(
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

  function toggleSection(status: TopicStatus) {
    setSectionsOpen((current) => ({
      ...current,
      [status]: !current[status],
    }));
  }

  function renderTopicCard(topic: Topic, index: number) {
    const script = generatedScripts[topic.id];
    const video = generatedVideos[topic.id];
    const uploadedVideo = uploadedVideos[topic.id];
    const isGenerating = generatingScriptFor === topic.id;
    const isRendering = renderingVideoFor === topic.id;
    const isUploading = uploadingVideoFor === topic.id;

    return (
      <article
        key={topic.id}
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 22,
          minWidth: 0,
          boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={mutedText}>Topic {index + 1}</span>

          <span
            style={{
              ...statusBadge,
              background:
                topic.status === "approved"
                  ? "#dcfce7"
                  : topic.status === "rejected"
                  ? "#fee2e2"
                  : "#f3f4f6",
              color:
                topic.status === "approved"
                  ? "#166534"
                  : topic.status === "rejected"
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
            margin: "14px 0 10px",
            overflowWrap: "anywhere",
          }}
        >
          {topic.title}
        </h3>

        <p style={descriptionText}>{topic.description}</p>

        <p
          style={{
            ...mutedText,
            marginTop: 16,
            overflowWrap: "anywhere",
          }}
        >
          Source: {topic.source || "Not specified"}
        </p>

        <div style={{ marginTop: 14 }}>
          <p style={{ ...mutedText, margin: "0 0 7px", fontWeight: 700 }}>
            YouTube references
          </p>

          {topic.youtubeVideos?.length ? (
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                display: "grid",
                gap: 6,
              }}
            >
              {topic.youtubeVideos.map((video) => (
                <li key={video.videoId} style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#1d4ed8", overflowWrap: "anywhere" }}
                  >
                    {video.title}
                  </a>
                  <span style={{ ...mutedText, marginLeft: 6 }}>
                    {video.channelTitle}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(topic.title)}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 13, color: "#1d4ed8" }}
            >
              Search YouTube for this topic
            </a>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 18,
          }}
        >
          <button
            onClick={() => setEditingTopic({ ...topic })}
            style={secondaryButton}
          >
            Edit
          </button>

          {topic.status !== "approved" && (
            <button
              onClick={() => updateStatus(topic.id, "approved")}
              style={primaryButton}
            >
              Approve
            </button>
          )}

          {topic.status !== "rejected" && (
            <button
              onClick={() => updateStatus(topic.id, "rejected")}
              style={secondaryButton}
            >
              Reject
            </button>
          )}
        </div>

        {topic.status === "approved" && (
          <div style={{ marginTop: 20 }}>
            <button
              onClick={() => generateScript(topic)}
              disabled={isGenerating}
              style={{
                ...primaryButton,
                opacity: isGenerating ? 0.6 : 1,
                cursor: isGenerating ? "not-allowed" : "pointer",
              }}
            >
              {isGenerating
                ? "Generating Script..."
                : script
                ? "Regenerate Script"
                : "Generate Script"}
            </button>

            {scriptErrors[topic.id] && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 8,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                }}
              >
                <p
                  style={{
                    ...errorText,
                    margin: 0,
                  }}
                >
                  {scriptErrors[topic.id]}
                </p>
              </div>
            )}

            {script && (
              <div
                style={{
                  marginTop: 18,
                  padding: 18,
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  background: "#f9fafb",
                }}
              >
                <h4
                  style={{
                    fontSize: 19,
                    margin: "0 0 12px",
                    lineHeight: 1.4,
                  }}
                >
                  {script.title}
                </h4>

                <p style={mutedText}>
                  Estimated duration:{" "}
                  {script.estimatedDurationMinutes} minutes
                </p>

                <h5 style={subheading}>Opening Hook</h5>

                <p style={descriptionText}>{script.hook}</p>

                <h5 style={subheading}>Documentary Script</h5>

                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    lineHeight: 1.8,
                    fontSize: 14,
                    color: "#374151",
                    maxHeight: 500,
                    overflowY: "auto",
                    paddingRight: 6,
                  }}
                >
                  {script.script}
                </div>

                {videoErrors[topic.id] && (
                  <p style={errorText}>{videoErrors[topic.id]}</p>
                )}

                <div style={{ marginTop: 22 }}>
                  <button
                    onClick={() => renderVideo(topic)}
                    disabled={isRendering}
                    style={{
                      ...secondaryButton,
                      opacity: isRendering ? 0.6 : 1,
                      cursor: isRendering ? "not-allowed" : "pointer",
                    }}
                  >
                    {isRendering
                      ? "Rendering MP4..."
                      : video
                      ? "Render Again"
                      : "Render Video"}
                  </button>

                  {video && (
                    <div style={{ marginTop: 14 }}>
                      <video
                        controls
                        preload="metadata"
                        src={`/api/media/${video.id}`}
                        style={{
                          display: "block",
                          width: "100%",
                          aspectRatio: "16 / 9",
                          background: "#111827",
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                          marginTop: 8,
                        }}
                      >
                        <span style={mutedText}>
                          {Math.floor(video.durationSeconds / 60)}:{String(
                            video.durationSeconds % 60
                          ).padStart(2, "0")} video
                        </span>
                        <a
                          href={`/api/media/${video.id}`}
                          download={`${video.title}.mp4`}
                          style={{ fontSize: 13, color: "#1d4ed8" }}
                        >
                          Download MP4
                        </a>
                      </div>

                      {uploadedVideo ? (
                        <p style={{ margin: "12px 0 0", fontSize: 13 }}>
                          Uploaded as {uploadedVideo.privacyStatus}.{" "}
                          <a
                            href={uploadedVideo.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#1d4ed8" }}
                          >
                            View on YouTube
                          </a>
                        </p>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            flexWrap: "wrap",
                            marginTop: 12,
                          }}
                        >
                          <label htmlFor={`youtube-privacy-${topic.id}`} style={mutedText}>
                            Visibility
                          </label>
                          <select
                            id={`youtube-privacy-${topic.id}`}
                            value={youtubePrivacy}
                            onChange={(event) =>
                              setYouTubePrivacy(
                                event.target.value as "private" | "unlisted" | "public"
                              )
                            }
                            disabled={!youtubeConnection.connected || isUploading}
                            style={{ ...inputStyle, width: "auto", padding: "7px 9px" }}
                          >
                            <option value="private">Private</option>
                            <option value="unlisted">Unlisted</option>
                            <option value="public">Public</option>
                          </select>
                          <button
                            onClick={() => uploadVideo(topic)}
                            disabled={!youtubeConnection.connected || isUploading}
                            style={{
                              ...primaryButton,
                              opacity: !youtubeConnection.connected || isUploading ? 0.6 : 1,
                              cursor: !youtubeConnection.connected || isUploading ? "not-allowed" : "pointer",
                            }}
                          >
                            {isUploading ? "Uploading..." : "Upload to YouTube"}
                          </button>
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

  function renderSection(status: TopicStatus) {
    const sectionTopics = topics.filter(
      (topic) => topic.status === status
    );

    const titles: Record<TopicStatus, string> = {
      pending: "Pending Review",
      approved: "Approved Topics",
      rejected: "Rejected Topics",
    };

    return (
      <section
        key={status}
        style={{
          marginBottom: 24,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => toggleSection(status)}
          aria-expanded={sectionsOpen[status]}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            width: "100%",
            padding: "20px 22px",
            background: "#fff",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            {titles[status]} ({sectionTopics.length})
          </span>

          <span
            style={{
              color: "#6b7280",
              fontSize: 22,
            }}
          >
            {sectionsOpen[status] ? "−" : "+"}
          </span>
        </button>

        {sectionsOpen[status] && (
          <div style={{ padding: "0 22px 22px" }}>
            {sectionTopics.length === 0 ? (
              <p
                style={{
                  color: "#6b7280",
                  fontSize: 14,
                  padding: "10px 0",
                }}
              >
                No {status} topics yet.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
                  gap: 18,
                }}
              >
                {sectionTopics.map((topic, index) =>
                  renderTopicCard(topic, index)
                )}
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  if (!hydrated) {
    return (
      <main style={pageStyle}>
        <p>Loading your saved topics and scripts...</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ marginBottom: 30 }}>
          <h1
            style={{
              fontSize: 34,
              lineHeight: 1.2,
              margin: "0 0 10px",
              color: "#111827",
            }}
          >
            AI Content Studio
          </h1>

          <p
            style={{
              color: "#6b7280",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Generate topics, review ideas, and create documentary scripts
            with AI agents.
          </p>
        </header>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <button
            onClick={generateTopics}
            disabled={loadingTopics}
            style={{
              ...primaryButton,
              opacity: loadingTopics ? 0.6 : 1,
              cursor: loadingTopics ? "not-allowed" : "pointer",
            }}
          >
            {loadingTopics ? "Generating Topics..." : "Generate Topics"}
          </button>

          {topics.length > 0 && (
            <button onClick={clearTopics} style={secondaryButton}>
              Clear All Topics
            </button>
          )}

          {youtubeConnection.connected ? (
            <button onClick={disconnectYouTube} style={secondaryButton}>
              Disconnect {youtubeConnection.channelTitle || "YouTube"}
            </button>
          ) : (
            <a
              href="/api/youtube/auth"
              style={{ ...secondaryButton, textDecoration: "none" }}
            >
              Connect YouTube
            </a>
          )}

          {youtubePrivacy === "public" && (
            <span style={{ ...mutedText, alignSelf: "center" }}>
              Public videos are visible to everyone after upload.
            </span>
          )}
        </div>

        {youtubeMessage && <p style={mutedText}>{youtubeMessage}</p>}
        {!youtubeConnection.configured && (
          <p style={mutedText}>
            Add the YouTube OAuth settings from the README to enable uploads.
          </p>
        )}

        {topicError && <p style={errorText}>{topicError}</p>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {(["pending", "approved", "rejected"] as TopicStatus[]).map(
            (status) => (
              <div key={status} style={summaryCard}>
                <p
                  style={{
                    ...mutedText,
                    textTransform: "capitalize",
                    margin: "0 0 8px",
                  }}
                >
                  {status}
                </p>

                <strong style={{ fontSize: 26, color: "#111827" }}>
                  {
                    topics.filter(
                      (topic) => topic.status === status
                    ).length
                  }
                </strong>
              </div>
            )
          )}
        </div>

        {topics.length === 0 ? (
          <div
            style={{
              padding: 44,
              background: "#fff",
              border: "1px dashed #d1d5db",
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <h2 style={{ fontSize: 20, margin: "0 0 10px" }}>
              No topics yet
            </h2>

            <p
              style={{
                color: "#6b7280",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              Click Generate Topics to start your content production
              workflow.
            </p>
          </div>
        ) : (
          <>
            {renderSection("pending")}
            {renderSection("approved")}
            {renderSection("rejected")}
          </>
        )}
      </div>

      {editingTopic && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEditingTopic(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(17, 24, 39, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            overflowY: "auto",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-topic-heading"
            style={{
              width: "100%",
              maxWidth: 620,
              background: "#fff",
              borderRadius: 14,
              padding: 26,
              boxSizing: "border-box",
              margin: "auto",
            }}
          >
            <h2
              id="edit-topic-heading"
              style={{
                fontSize: 23,
                margin: "0 0 22px",
              }}
            >
              Edit Topic
            </h2>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveEdit();
              }}
            >
              <label htmlFor="topic-title" style={labelStyle}>
                Title
              </label>

              <input
                id="topic-title"
                required
                value={editingTopic.title}
                onChange={(event) =>
                  setEditingTopic({
                    ...editingTopic,
                    title: event.target.value,
                  })
                }
                style={inputStyle}
              />

              <label htmlFor="topic-description" style={labelStyle}>
                Description
              </label>

              <textarea
                id="topic-description"
                required
                rows={5}
                value={editingTopic.description}
                onChange={(event) =>
                  setEditingTopic({
                    ...editingTopic,
                    description: event.target.value,
                  })
                }
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />

              <label htmlFor="topic-source" style={labelStyle}>
                Source
              </label>

              <input
                id="topic-source"
                value={editingTopic.source}
                onChange={(event) =>
                  setEditingTopic({
                    ...editingTopic,
                    source: event.target.value,
                  })
                }
                style={inputStyle}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 24,
                }}
              >
                <button
                  type="button"
                  onClick={() => setEditingTopic(null)}
                  style={secondaryButton}
                >
                  Cancel
                </button>

                <button type="submit" style={primaryButton}>
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

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "40px 24px",
  background: "#f7f8fa",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#111827",
  boxSizing: "border-box",
};

const primaryButton: React.CSSProperties = {
  padding: "11px 16px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  padding: "10px 15px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#374151",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
};

const mutedText: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
};

const descriptionText: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: "#4b5563",
  overflowWrap: "anywhere",
};

const statusBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "5px 9px",
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
};

const summaryCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 18,
};

const errorText: React.CSSProperties = {
  color: "#b91c1c",
  fontSize: 14,
  lineHeight: 1.6,
  overflowWrap: "anywhere",
};

const subheading: React.CSSProperties = {
  fontSize: 15,
  margin: "20px 0 8px",
  color: "#111827",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 7,
  marginTop: 16,
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 7,
  fontSize: 14,
  color: "#111827",
};