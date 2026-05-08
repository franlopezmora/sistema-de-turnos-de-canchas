import type { CSSProperties } from 'react';
import Image from 'next/image';

export const PUNTO_LOGO_ASSETS = {
  horizontal: '/brand/punto-logo-horizontal.svg',
  horizontalLight: '/brand/punto-logo-horizontal-light.svg',
  horizontalDark: '/brand/punto-logo-horizontal-dark.svg',
  horizontalTagline: '/brand/punto-logo-horizontal-tagline.svg',
  isotipo: '/brand/punto-isotipo.svg',
  isotipoDark: '/brand/punto-isotipo-dark.svg',
} as const;

type PuntoLogoVariant = keyof typeof PUNTO_LOGO_ASSETS;

type PuntoLogoProps = {
  variant?: PuntoLogoVariant;
  className?: string;
  style?: CSSProperties;
  alt?: string;
};

const PUNTO_LOGO_DIMENSIONS: Record<PuntoLogoVariant, { width: number; height: number }> = {
  horizontal: { width: 196, height: 64 },
  horizontalLight: { width: 196, height: 64 },
  horizontalDark: { width: 196, height: 64 },
  horizontalTagline: { width: 320, height: 72 },
  isotipo: { width: 64, height: 64 },
  isotipoDark: { width: 64, height: 64 },
};

export default function PuntoLogo({
  variant = 'horizontal',
  className,
  style,
  alt = 'punto',
}: PuntoLogoProps) {
  const dimensions = PUNTO_LOGO_DIMENSIONS[variant];

  return (
    <Image
      src={PUNTO_LOGO_ASSETS[variant]}
      alt={alt}
      width={dimensions.width}
      height={dimensions.height}
      className={className}
      style={style}
      draggable={false}
      priority={false}
      unoptimized
    />
  );
}
