import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "../../lib/cn";

const control =
  "w-full rounded-control border border-line bg-raised px-3 py-2 text-text placeholder:text-muted disabled:opacity-50";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

/** A native select: fully keyboard and screen reader accessible, and styled with the same tokens. */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "appearance-auto", className)} {...props} />;
}

/** Label above a control. Every input has one. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => ReactNode;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {children({
        id,
        "aria-describedby": hint || error ? noteId : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {error ? (
        <p id={noteId} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
