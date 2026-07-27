import { Ear, Hand, Printer, Waves, Bell, FileDown, Box } from "lucide-react";

const cards = [
  {
    label: "Live audio canvas",
    icon: Ear,
    header: "from-primary to-primary/80",
    rotate: "-rotate-3",
    translate: "sm:translate-y-4",
    content: (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Pan</span>
          <span className="font-semibold text-foreground">62% right</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-primary/15">
          <div className="h-full w-[62%] rounded-full bg-primary" />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Pitch</span>
          <span className="font-semibold text-foreground">480 Hz</span>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          {[3, 6, 9, 5, 8, 4, 7].map((h, i) => (
            <span key={i} className="w-1.5 rounded-full bg-primary/50" style={{ height: h * 3 }} />
          ))}
        </div>
      </div>
    ),
  },
  {
    label: "Draw with intention",
    icon: Hand,
    header: "from-accent to-accent/80",
    rotate: "rotate-2",
    translate: "sm:-translate-y-2",
    content: (
      <div className="space-y-3">
        <svg viewBox="0 0 160 60" className="h-14 w-full">
          <path
            d="M6 50 C 40 10, 60 50, 90 20 S 140 45, 154 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-accent-foreground"
          />
          <circle cx="154" cy="12" r="4" className="fill-accent-foreground" />
        </svg>
        <div className="flex items-center gap-2 rounded-full bg-accent/30 px-3 py-1.5 text-xs font-medium text-accent-foreground">
          <Bell className="h-3.5 w-3.5" /> Point placed — chime confirmed
        </div>
      </div>
    ),
  },
  {
    label: "Hold your art",
    icon: Printer,
    header: "from-secondary to-secondary/80",
    rotate: "-rotate-2",
    translate: "sm:translate-y-6",
    content: (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2.5 text-xs font-medium text-secondary-foreground">
          <span className="flex items-center gap-2"><FileDown className="h-4 w-4" /> Swell paper SVG</span>
          <span className="text-[10px] text-muted-foreground">ready</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2.5 text-xs font-medium text-secondary-foreground">
          <span className="flex items-center gap-2"><Box className="h-4 w-4" /> 3D print STL</span>
          <span className="text-[10px] text-muted-foreground">ready</span>
        </div>
      </div>
    ),
  },
  {
    label: "Made together",
    icon: Waves,
    header: "from-primary/90 to-accent/90",
    rotate: "rotate-1",
    translate: "sm:-translate-y-4",
    content: (
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-1.5">
          {["bg-primary/60", "bg-accent/60", "bg-secondary/60", "bg-primary/40", "bg-accent/40", "bg-primary/30", "bg-secondary/40", "bg-accent/30"].map((c, i) => (
            <span key={i} className={`aspect-square rounded-md ${c}`} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">128 drawings</span> shared this week
        </p>
      </div>
    ),
  },
];

export function StudioPreviewCards() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-6 pt-10 sm:pt-16">
      <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
        A peek inside the studio
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
        Sound becomes shape, and shape becomes something you can hold.
      </p>

      <div className="mt-12 flex flex-wrap items-start justify-center gap-6 sm:mt-16 sm:gap-5">
        {cards.map(({ label, icon: Icon, header, rotate, translate, content }) => (
          <div
            key={label}
            className={`w-full max-w-[220px] shrink-0 overflow-hidden rounded-2xl bg-card shadow-lg ring-1 ring-primary/15 transition-transform duration-300 hover:-translate-y-1 hover:rotate-0 ${rotate} ${translate}`}
          >
            <div className={`flex items-center gap-2 bg-gradient-to-r ${header} px-4 py-2.5 text-primary-foreground`}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate text-xs font-semibold">{label}</span>
            </div>
            <div className="p-4">{content}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
