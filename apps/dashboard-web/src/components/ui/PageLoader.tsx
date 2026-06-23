import { Skeleton, SkeletonText } from "./primitives";

export default function PageLoader() {
  return (
    <div className="page-stack page-stack-compact" role="status" aria-live="polite" aria-label="Loading module">
      <div>
        <Skeleton style={{ display: "block", height: "1.6rem", width: "14rem", marginBottom: "0.6rem" }} />
        <Skeleton style={{ display: "block", height: "0.9rem", width: "22rem" }} />
      </div>
      <div className="panel">
        <SkeletonText lines={4} />
      </div>
      <div className="panel">
        <SkeletonText lines={6} />
      </div>
    </div>
  );
}
