"use client";

// PDP gallery — main image + thumbnail rail; graceful muted placeholder when images are missing.

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface GalleryImage {
  url: string;
  alt: string | null;
}

export function Gallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const [index, setIndex] = useState(0);
  const active = images[index];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
        {active ? (
          <img
            key={active.url}
            src={active.url}
            alt={active.alt ?? name}
            className="rise-in h-full w-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <div>
              <p className="label-caps">Product photography</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Photographs for this item are being added. Visit the counter for a live demo.
              </p>
            </div>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label="Product images">
          {images.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              role="option"
              aria-selected={i === index}
              aria-label={`View image ${i + 1} of ${images.length}`}
              onClick={() => setIndex(i)}
              className={cn(
                "relative h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted transition-all duration-200 hover:scale-[1.03]",
                i === index
                  ? "border-primary opacity-100 ring-1 ring-primary/30"
                  : "border-border opacity-70 hover:opacity-100"
              )}
            >
              <img src={img.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
