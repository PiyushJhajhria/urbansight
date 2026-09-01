function LoadingBlock({ label = "Loading intelligence feed..." }) {
  return (
    <div className="loading-block">
      <div className="loader" />
      <p>{label}</p>
    </div>
  );
}

export default LoadingBlock;
