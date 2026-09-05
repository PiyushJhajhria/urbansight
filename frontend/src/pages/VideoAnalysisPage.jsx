import { useEffect, useRef, useState } from "react";
import {
  CheckCircle,
  FileVideo,
  Loader2,
  Play,
  Upload,
  Video,
} from "lucide-react";
import {
  getVideoOutputUrl,
  getVideoStatus,
  uploadVideo,
} from "../api";

function VideoAnalysisPage() {
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  function handleFileChange(event) {
  const file = event.target.files?.[0];

  if (file) {
    setSelectedFile(file);
    setJobId(null);
    setStatus(null);
    setError(null);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }
}

  function handleChooseVideo() {
    fileInputRef.current?.click();
  }

  async function handleUpload() {
    if (!selectedFile) {
      return;
    }

    try {
      setError(null);
      setStatus("uploading");

      const response = await uploadVideo(selectedFile);

      setJobId(response.data.job_id);
      setStatus("queued");
    } catch (err) {
      console.error(err);
      setStatus("failed");
      setError(
        err.response?.data?.detail ||
          "Failed to upload the video."
      );
    }
  }

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let intervalId;

    async function checkStatus() {
      try {
        const response = await getVideoStatus(jobId);

        setStatus(response.data.status);

        if (
          response.data.status === "completed" ||
          response.data.status === "failed"
        ) {
          clearInterval(intervalId);

          if (response.data.status === "failed") {
            setError(
              response.data.error ||
                "Video processing failed."
            );
          }
        }
      } catch (err) {
        console.error(err);
        clearInterval(intervalId);
        setStatus("failed");
        setError(
          "Could not check video processing status."
        );
      }
    }

    checkStatus();

    intervalId = setInterval(checkStatus, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, [jobId]);

  const isProcessing =
    status === "uploading" ||
    status === "queued" ||
    status === "processing";

  const isCompleted = status === "completed";

  return (
    <section className="page video-analysis-page">

      {/* PAGE HEADER */}
      <div className="video-page-header">
        <div>
          <div className="video-section-label">
            VIDEO ANALYSIS
          </div>

          <h1>Traffic Video Investigation</h1>

          <p>
            Process recorded CCTV footage and review
            detected license plates and tracked objects.
          </p>
        </div>

        <div className="video-system-status">
          <span className="status-dot" />
          ANALYSIS SYSTEM
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="video-workspace">

        {/* SOURCE PANEL */}
        <div className="video-panel source-panel">

          <div className="panel-heading">
            <div>
              <span className="panel-index">01</span>
              <div>
                <h2>Source Video</h2>
                <p>Select CCTV footage for analysis</p>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            hidden
          />

          <div
            className={`video-drop-zone ${
              selectedFile ? "has-file" : ""
            }`}
            onClick={handleChooseVideo}
          >
            
            {previewUrl && (
        <div className="video-preview">
            <div className="video-preview-label">
                VIDEO PREVIEW
            </div>

            <video
                src={previewUrl}
                controls
                muted
                className="preview-video"
            />
        </div>
    )}
            <div className="video-file-icon">
              {selectedFile ? (
                <FileVideo size={26} />
              ) : (
                <Video size={26} />
              )}
            </div>

            {selectedFile ? (
              <>
                <strong>{selectedFile.name}</strong>

                <span>
                  {(selectedFile.size / (1024 * 1024)).toFixed(
                    1
                  )}{" "}
                  MB
                </span>
              </>
            ) : (
              <>
                <strong>Select CCTV footage</strong>

                <span>
                  MP4, AVI, MOV and other video formats
                </span>
              </>
            )}

            <button
              type="button"
              className="secondary-video-button"
              onClick={(event) => {
                event.stopPropagation();
                handleChooseVideo();
              }}
              disabled={isProcessing}
            >
              <Upload size={16} />
              {selectedFile ? "Change Video" : "Browse Files"}
            </button>
          </div>

          {selectedFile && !jobId && (
            <button
              className="primary-video-button"
              type="button"
              onClick={handleUpload}
              disabled={status === "uploading"}
            >
              {status === "uploading" ? (
                <>
                  <Loader2
                    size={17}
                    className="spin"
                  />
                  Uploading
                </>
              ) : (
                <>
                  <Play size={17} />
                  Start Analysis
                </>
              )}
            </button>
          )}

          {selectedFile && (
            <div className="video-file-meta">
              <span>INPUT</span>
              <strong>{selectedFile.type || "Video file"}</strong>
            </div>
          )}
        </div>

        {/* PROCESSING PANEL */}
        <div className="video-panel processing-panel">

          <div className="panel-heading">
            <div>
              <span className="panel-index">02</span>
              <div>
                <h2>Processing</h2>
                <p>Detection pipeline status</p>
              </div>
            </div>
          </div>

          <div className="processing-status">

            <div
              className={`large-status-indicator ${
                isCompleted
                  ? "complete"
                  : isProcessing
                  ? "active"
                  : ""
              }`}
            >
              {isCompleted ? (
                <CheckCircle size={24} />
              ) : isProcessing ? (
                <Loader2
                  size={24}
                  className="spin"
                />
              ) : (
                <Video size={24} />
              )}
            </div>

            <div>
              <span className="status-caption">
                STATUS
              </span>

              <strong>
                {status === "uploading"
                  ? "Uploading"
                  : status === "queued"
                  ? "Queued"
                  : status === "processing"
                  ? "Processing"
                  : status === "completed"
                  ? "Complete"
                  : status === "failed"
                  ? "Failed"
                  : "Ready"}
              </strong>
            </div>
          </div>

          <div className="pipeline-list">

            <div className="pipeline-row">
              <span>01</span>
              <div>
                <strong>Object Detection</strong>
                <small>YOLO inference</small>
              </div>
              <i
                className={
                  isProcessing || isCompleted
                    ? "pipeline-active"
                    : ""
                }
              />
            </div>

            <div className="pipeline-row">
              <span>02</span>
              <div>
                <strong>Object Tracking</strong>
                <small>ByteTrack</small>
              </div>
              <i
                className={
                  isProcessing || isCompleted
                    ? "pipeline-active"
                    : ""
                }
              />
            </div>

            <div className="pipeline-row">
              <span>03</span>
              <div>
                <strong>Plate Recognition</strong>
                <small>OCR / ANPR</small>
              </div>
              <i
                className={
                  isProcessing || isCompleted
                    ? "pipeline-active"
                    : ""
                }
              />
            </div>

          </div>

          {isProcessing && (
            <div className="processing-message">
              <Loader2 size={15} className="spin" />

              <span>
                {status === "uploading"
                  ? "Uploading footage to the server..."
                  : "Analyzing footage. This may take some time."}
              </span>
            </div>
          )}

          {isCompleted && (
            <div className="completed-message">
              <CheckCircle size={16} />
              Analysis completed successfully
            </div>
          )}

          {error && (
            <div className="video-error">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* RESULT */}
      {isCompleted && jobId && (
        <div className="video-result-panel">

          <div className="result-header">
            <div>
              <span className="video-section-label">
                ANALYSIS OUTPUT
              </span>

              <h2>Processed Footage</h2>
            </div>

            <div className="result-complete">
              <CheckCircle size={16} />
              COMPLETE
            </div>
          </div>

          <div className="processed-video-wrapper">
            <video
              className="processed-video"
              controls
              src={getVideoOutputUrl(jobId)}
            />
          </div>

        </div>
      )}

    </section>
  );
}

export default VideoAnalysisPage;