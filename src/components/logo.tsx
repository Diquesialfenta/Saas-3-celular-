import { APP_NAME } from "@/lib/config";
import { cx } from "./ui";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("size-6", className)} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#232323" />
      <circle cx="8" cy="8" r="2.2" fill="#a1ffcb" />
      <circle cx="16" cy="8" r="2.2" fill="#fff" />
      <circle cx="8" cy="16" r="2.2" fill="#fff" />
      <circle cx="16" cy="16" r="2.2" fill="#fff" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-display text-[19px] tracking-[-0.03em]", className)}>
      <Mark />
      {APP_NAME}
    </span>
  );
}
