import { useEffect, useRef, useState } from "react";
import { CheckCircle, Loader2, Upload, Video } from "lucide-react";
import {
  getVideoOutputUrl,
  getVideoStatus,
  uploadVideo,
} from "../api";

function VideoAnalysisPage() {
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
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
        setError("Could not check video processing status.");
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
      <div className="page-header">
        <div>
          <p className="eyebrow">AI VIDEO PROCESSING</p>

          <h1>Video Analysis</h1>

          <p>
            Upload a traffic video to run UrbanSight AI
            detection and ANPR.
          </p>
        </div>
      </div>

      <div className="video-upload-card">
        <div className="upload-icon">
          <Video size={32} />
        </div>

        <h2>Upload CCTV Video</h2>

        <p>
          Select a traffic video to analyze vehicle and
          license plate detections.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          hidden
        />

        <button
          className="upload-button"
          type="button"
          onClick={handleChooseVideo}
          disabled={isProcessing}
        >
          <Upload size={18} />
          Choose Video
        </button>

        {selectedFile ? (
          <div className="selected-file">
            <strong>Selected:</strong>{" "}
            {selectedFile.name}
          </div>
        ) : (
          <span className="upload-hint">
            MP4, AVI, MOV or other supported video formats
          </span>
        )}

        {selectedFile && !jobId && (
          <button
            className="upload-button"
            type="button"
            onClick={handleUpload}
            disabled={status === "uploading"}
          >
            {status === "uploading" ? (
              <>
                <Loader2 size={18} className="spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={18} />
                Start Analysis
              </>
            )}
          </button>
        )}

        {isProcessing && (
          <div className="video-status">
            <Loader2 size={20} className="spin" />

            <div>
              <strong>
                {status === "uploading"
                  ? "Uploading video..."
                  : "AI processing in progress..."}
              </strong>

              <span>
                YOLO detection, tracking and ANPR are
                running.
              </span>
            </div>
          </div>
        )}

        {isCompleted && jobId && (
          <div className="video-result">
            <div className="video-success">
              <CheckCircle size={20} />

              <strong>
                Video processing completed
              </strong>
            </div>

            <video
              className="processed-video"
              controls
              src={getVideoOutputUrl(jobId)}
            />
          </div>
        )}

        {error && (
          <div className="video-error">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}

export default VideoAnalysisPage;