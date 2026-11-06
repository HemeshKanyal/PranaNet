/* eslint-disable @next/next/no-img-element */
// One piece of the hand-painted kit: 480 px rendition on phones, 900 px on larger screens.
import { ART, artSrc, type ArtName } from "@/lib/story/poses";

export function Art({ name, className = "", priority = false, small = false, alt = "" }: {
  name: ArtName;
  className?: string;
  priority?: boolean;
  /** always use the 480 px rendition (small props and icons) */
  small?: boolean;
  alt?: string;
}) {
  const { sm, lg } = ART[name];
  const img = (
    <img
      src={artSrc(name, small ? "480" : "900")}
      width={small ? sm[0] : lg[0]}
      height={small ? sm[1] : lg[1]}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      draggable={false}
      className={`select-none ${className}`}
    />
  );
  if (small) return img;
  return (
    <picture className="contents">
      <source media="(max-width: 767px)" srcSet={artSrc(name, "480")} width={sm[0]} height={sm[1]} />
      {img}
    </picture>
  );
}
