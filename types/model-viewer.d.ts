declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': ModelViewerJSX & React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
  }
}

interface ModelViewerJSX {
  src?: string
  'ios-src'?: string
  alt?: string
  poster?: string
  'seamless-poster'?: boolean
  loading?: 'auto' | 'lazy' | 'eager'
  reveal?: 'auto' | 'interaction' | 'manual'

  // AR attributes
  ar?: boolean
  'ar-modes'?: string
  'ar-scale'?: 'auto' | 'fixed'
  'ar-placement'?: 'floor' | 'wall'
  'xr-environment'?: boolean

  // Camera controls
  'camera-controls'?: boolean
  'camera-orbit'?: string
  'camera-target'?: string
  'field-of-view'?: string
  'min-camera-orbit'?: string
  'max-camera-orbit'?: string
  'min-field-of-view'?: string
  'max-field-of-view'?: string

  // Interaction
  'auto-rotate'?: boolean
  'auto-rotate-delay'?: number
  'rotation-per-second'?: string
  'interaction-prompt'?: 'auto' | 'when-focused' | 'none'
  'interaction-prompt-threshold'?: number
  'interaction-policy'?: 'always-allow' | 'allow-when-focused'

  // Lighting & environment
  'environment-image'?: string
  'skybox-image'?: string
  'exposure'?: number
  'shadow-intensity'?: number
  'shadow-softness'?: number

  // Staging
  'max-camera-orbit'?: string
  'min-camera-orbit'?: string

  // Events
  onLoad?: () => void
  onError?: (event: ErrorEvent) => void

  // Slots
  children?: React.ReactNode

  // Style
  style?: React.CSSProperties
  className?: string
  ref?: React.Ref<HTMLElement & ModelViewerElement>
}

interface ModelViewerElement extends HTMLElement {
  // Model info
  readonly loaded: boolean
  readonly modelIsVisible: boolean

  // Camera
  cameraOrbit: string
  cameraTarget: string
  fieldOfView: string

  // Animation
  readonly availableAnimations: string[]
  animationName: string | null
  play: (options?: { repetitions?: number }) => void
  pause: () => void

  // AR
  readonly canActivateAR: boolean
  activateAR: () => void

  // Model manipulation
  getBoundingBoxCenter: () => { x: number; y: number; z: number }
  getDimensions: () => { x: number; y: number; z: number }
  jumpCameraToGoal: () => void
  resetTurntableRotation: (theta?: number) => void

  // Material
  readonly model: {
    materials: Array<{
      pbrMetallicRoughness: {
        setBaseColorFactor: (rgba: [number, number, number, number]) => void
      }
    }>
  }
}
