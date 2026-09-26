import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Markdown body for blog posts. No typography plugin — every element is
// styled explicitly through the components map (editorial contract:
// font-display headings, 15px body, hairline tables).

type AnchorProps = ComponentPropsWithoutRef<"a">;
type ImgProps = ComponentPropsWithoutRef<"img">;

export function BlogPostBody({ content }: { content: string }) {
  return (
    <div className="max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="mt-12 font-display text-2xl leading-snug tracking-tight first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-9 font-display text-xl leading-snug tracking-tight">{children}</h3>
          ),
          h4: ({ children }) => <h4 className="mt-8 text-base font-semibold tracking-tight">{children}</h4>,
          p: ({ children }) => (
            <p className="mt-4 text-[15px] leading-relaxed text-foreground/90 first:mt-0">{children}</p>
          ),
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children, ...rest }: AnchorProps) => {
            const internal = typeof href === "string" && href.startsWith("/");
            if (internal) {
              return (
                <Link href={href} className="underline underline-offset-2 hover:text-foreground">
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
                {...rest}
              >
                {children}
              </a>
            );
          },
          ul: ({ children }) => <ul className="mt-4 list-disc space-y-1.5 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mt-4 list-decimal space-y-1.5 pl-5">{children}</ol>,
          li: ({ children }) => <li className="text-[15px] leading-relaxed text-foreground/90">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mt-6 border-l-2 border-primary/40 pl-4 text-[15px] italic leading-relaxed text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="mt-10 border-border" />,
          table: ({ children }) => (
            <div className="mt-6 overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-left">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-border px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border px-4 py-2.5 text-[14px] leading-relaxed text-foreground/90">
              {children}
            </td>
          ),
          pre: ({ children }) => (
            <pre className="thin-scrollbar mt-6 overflow-x-auto rounded-lg border border-border bg-muted/60 p-4 text-[13px] leading-relaxed">
              {children}
            </pre>
          ),
          code: ({ className, children, ...rest }: ComponentPropsWithoutRef<"code">) => {
            const isBlock = typeof className === "string" && className.includes("language-");
            if (isBlock) {
              return (
                <code className="font-mono text-[13px] text-foreground/90" {...rest}>
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground" {...rest}>
                {children}
              </code>
            );
          },
          img: ({ src, alt, ...rest }: ImgProps) => (
            <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" className="mt-6 rounded-lg border border-border" {...rest} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
