import { Icon, type IconProps } from '@chakra-ui/react';

/** Small stroke icons (24x24 viewBox, currentColor). All are decorative by default. */
const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function MailIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
      <g {...strokeProps}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </g>
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
      <g {...strokeProps}>
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </g>
    </Icon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
      <g {...strokeProps}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </g>
    </Icon>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
      <g {...strokeProps}>
        <path d="M9.9 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A16.5 16.5 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6" />
        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        <path d="m3 3 18 18" />
      </g>
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
      <g {...strokeProps}>
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </g>
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
      <g {...strokeProps}>
        <path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </g>
    </Icon>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
      <g {...strokeProps}>
        <path d="M11 3 9.5 8.5 4 10l5.5 1.5L11 17l1.5-5.5L18 10l-5.5-1.5L11 3Z" />
        <path d="M19 15v4M17 17h4" />
      </g>
    </Icon>
  );
}

export function FileTextIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
      <g {...strokeProps}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </g>
    </Icon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
      <g {...strokeProps}>
        <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
      </g>
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
      <g {...strokeProps}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </g>
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
      <g {...strokeProps}>
        <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
      </g>
    </Icon>
  );
}

/** Google "G" in the official four-colour style. */
export function GoogleGIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 48 48" aria-hidden focusable={false} {...props}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6Z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48Z"
      />
    </Icon>
  );
}
