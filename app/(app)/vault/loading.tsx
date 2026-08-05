export default function Loading() {
  return (
    <div className="flex-1 min-h-screen bg-black p-4 md:p-8 animate-pulse">
      <div className="w-full max-w-[900px] mx-auto space-y-6">
        <div className="h-8 w-36 bg-[#161412] border border-white/[0.06] rounded-xl" />
        <div className="space-y-4">
          {[1,2,3].map((i) => (
            <div key={i} className="h-[96px] bg-[#161412] border border-white/[0.06] rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
