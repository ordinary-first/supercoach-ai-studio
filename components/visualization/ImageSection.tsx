import { useState } from 'react';

interface ImageSectionProps {
  imageUrl?: string;
  imageDataUrl?: string;
  isLoading: boolean;
}

const floatStyle = `
@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  33% { transform: translate(20px, -15px); }
  66% { transform: translate(-10px, 10px); }
}
`;

const BLOB_COLORS = [
  'rgba(139, 92, 246, 0.3)',
  'rgba(59, 130, 246, 0.3)',
  'rgba(236, 72, 153, 0.3)',
];

function ImageSection({ imageUrl, imageDataUrl, isLoading }: ImageSectionProps) {
  const [useFallback, setUseFallback] = useState(false);
  const src = useFallback ? imageDataUrl : imageUrl;
  const hasImage = !!(imageUrl || imageDataUrl);

  return (
    <section style={{ backgroundColor: '#111111' }}>
      <style>{floatStyle}</style>
      <div className="px-6 pt-5 pb-2">
        <span
          className="font-medium uppercase"
          style={{
            color: '#444',
            fontSize: '11px',
            letterSpacing: '0.12em',
          }}
        >
          SCENE &middot; IMAGE
        </span>
      </div>

      {hasImage && src && (
        <img
          src={src}
          alt="Dream visualization"
          className="w-full object-cover"
          onError={() => {
            if (!useFallback && imageDataUrl) setUseFallback(true);
          }}
        />
      )}

      {!hasImage && isLoading && (
        <div
          className="relative overflow-hidden"
          style={{ height: '100vw', backgroundColor: '#0D0D0D' }}
        >
          {BLOB_COLORS.map((color, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: '40%',
                height: '40%',
                top: `${20 + i * 15}%`,
                left: `${10 + i * 20}%`,
                backgroundColor: color,
                filter: 'blur(40px)',
                opacity: 0.3,
                animation: `float 8s ease-in-out ${i * 2.5}s infinite`,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default ImageSection;
