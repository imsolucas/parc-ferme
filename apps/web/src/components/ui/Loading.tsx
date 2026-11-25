/** NOW LOADING: eight blocks stepping on and off. Reduced motion holds them lit. */
export function Loading() {
  return (
    <div role="status" className="font-pixel text-pixel-title flex flex-col items-center gap-4 py-10 leading-normal text-neon-yellow">
      <span>NOW LOADING</span>
      <span aria-hidden className="loadbar flex gap-1">
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} className="block size-3 bg-neon-green" />
        ))}
      </span>
    </div>
  );
}
