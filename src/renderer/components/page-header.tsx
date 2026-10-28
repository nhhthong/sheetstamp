import type { ReactNode } from "react";

/** Page title 32 px bold, subtitle 14 px muted, about 44 px page padding around the content. */
export function Page({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="page-title"
      className="mx-auto max-w-[960px] px-[44px] py-[44px] max-[819px]:px-4 max-[819px]:py-6"
    >
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 id="page-title" className="text-[32px] leading-tight font-bold">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
