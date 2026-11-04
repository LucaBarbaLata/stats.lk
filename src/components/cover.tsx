import Image from "next/image";

// Album art, artist photo or avatar. Spotify images are already sized, so
// they skip Next's image optimizer. A tinted square shows while it loads;
// without an image, the first letter stands in.
export function Cover({
  src,
  size,
  rounded,
  label,
}: {
  src: string | null;
  size: number;
  rounded?: boolean;
  label: string;
}) {
  const shape = rounded ? "rounded-full" : size >= 96 ? "rounded-xl" : "rounded-md";
  if (!src) {
    return (
      <div
        aria-hidden
        className={`${shape} flex aspect-square shrink-0 items-center justify-center bg-surface-2 font-semibold text-subtle select-none`}
        style={{ width: size, maxWidth: "100%", fontSize: Math.max(12, size / 3) }}
      >
        {label.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      unoptimized
      draggable={false}
      className={`${shape} aspect-square shrink-0 bg-surface-2 object-cover`}
      style={{ maxWidth: "100%", height: "auto" }}
    />
  );
}
