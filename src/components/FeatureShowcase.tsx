import { Music, Users, Download, Zap } from "lucide-react";

interface FeatureCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

const features: FeatureCard[] = [
  {
    icon: <Music className="h-8 w-8" />,
    title: "Hear the Canvas",
    description: "Transform visual art into immersive soundscapes and tactile experiences",
    gradient: "from-purple-500 to-blue-500",
  },
  {
    icon: <Users className="h-8 w-8" />,
    title: "Create Together",
    description: "Collaborate with other artists in real-time shared creative spaces",
    gradient: "from-pink-500 to-purple-500",
  },
  {
    icon: <Download className="h-8 w-8" />,
    title: "Export & Share",
    description: "Download your work in multiple formats and share with the community",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: <Zap className="h-8 w-8" />,
    title: "Accessibility First",
    description: "Built from the ground up for blind and low-vision creators worldwide",
    gradient: "from-amber-500 to-orange-500",
  },
];

export function FeatureShowcase() {
  return (
    <section className="relative w-full py-20 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            What You Can Do
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Perceive empowers creators to express their vision in new, accessible ways
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 perspective">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative h-full"
              style={{
                perspective: "1000px",
              }}
            >
              {/* Card with 3D tilt effect */}
              <div
                className="relative h-full rounded-2xl bg-gradient-to-br from-white/10 to-white/5 dark:from-slate-800/40 dark:to-slate-900/30 backdrop-blur-lg border border-white/10 dark:border-slate-700/30 p-8 transition-all duration-300 hover:shadow-2xl overflow-hidden"
                style={{
                  transformStyle: "preserve-3d",
                  transform: `rotateY(${-2 + index % 2 * 4}deg) rotateX(${2 - (index % 2) * 4}deg)`,
                }}
              >
                {/* Gradient glow background */}
                <div
                  className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-3xl bg-gradient-to-br ${feature.gradient} rounded-2xl`}
                />

                {/* Content */}
                <div className="relative z-10">
                  {/* Icon */}
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} p-3 mb-6 shadow-lg transform group-hover:scale-110 transition-transform duration-300`}
                  >
                    <div className="text-white">{feature.icon}</div>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl md:text-2xl font-bold mb-3 text-white group-hover:text-primary transition-colors duration-300">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm md:text-base text-slate-300 group-hover:text-slate-200 transition-colors duration-300 leading-relaxed">
                    {feature.description}
                  </p>

                  {/* Accent line */}
                  <div
                    className={`h-1 bg-gradient-to-r ${feature.gradient} rounded-full mt-6 w-0 group-hover:w-full transition-all duration-500`}
                  />
                </div>

                {/* Border glow on hover */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom accent line */}
        <div className="mt-20 pt-12 border-t border-primary/20">
          <p className="text-center text-muted-foreground text-sm">
            Perceive is designed by blind and low-vision creators, for everyone
          </p>
        </div>
      </div>
    </section>
  );
}
