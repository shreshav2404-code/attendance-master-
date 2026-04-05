import { MotiView } from "moti";

interface SkeletonCardProps {
  className?: string;
}

export const SkeletonCard = ({ className }: SkeletonCardProps) => (
  <MotiView
    className={`h-28 rounded-[28px] bg-white/5 ${className ?? ""}`}
    from={{ opacity: 0.35 }}
    animate={{ opacity: 0.85 }}
    transition={{
      type: "timing",
      duration: 850,
      loop: true,
      repeatReverse: true,
    }}
  />
);
