import { useState, useRef, useEffect } from "react"

type Screen =
  | "home"
  | "records"
  | "timeline"
  | "medications"
  | "profile"
  | "reports"
  | "result"
  | "revoke"
  | "shared"
  | "lostPhone"
  | "recovered"
  | "verifyRecovery"
  | "recoverAccount"
  | "emptyVault"
  | "preferences"
  | "createAccount"
  | "welcome"
  | "bookingReview"
  | "bookingTime"
  | "offline"
  | "uploadFailed"
  | "labsLoading"
  | "onboardingRecord"
  | "onboardingId"
  | "verifyPhone"
  | "checkedIn"
  | "checkIn"
  | "bookingConfirmed"
  | "recordChat"
  | "careDiscovery"
  | "visitPrep"
  | "careJourney"
  | "uploadReview"
  | "consentExpanded"
  | "recordActivity"
  | "emergencyQr"
  | "emergencyInfo"
  | "healthPassport"
  | "recordAdded"
  | "signIn"

const A = "/assets"

const icons = {
  fingerprint: `${A}/b8a6e.svg`,
  homeNav: `${A}/308fc.svg`,
  send: `${A}/f087f.svg`,
  scan: `${A}/134ff.svg`,
  lab: `${A}/061bb.svg`,
  calendar: `${A}/978b1.svg`,
  chevron: `${A}/56145.svg`,
  clipboard: `${A}/3ee57.svg`,
  pill: `${A}/19cf9.svg`,
  badge: `${A}/1951a.svg`,
  search: `${A}/0aa29.svg`,
  history: `${A}/fddca.svg`,
  book: `${A}/027fc.svg`,
  stethoscope: `${A}/85f93.svg`,
  imaging: `${A}/7bf12.svg`,
  fileHeart: `${A}/86d04.svg`,
  syringe: `${A}/71d84.svg`,
  allergy: `${A}/aedd2.svg`,
  activity: `${A}/d0fa7.svg`,
  files: `${A}/15af9.svg`,
  upload: `${A}/c7870.svg`,
  filter: `${A}/0866c.svg`,
  check: `${A}/0792b.svg`,
  minus: `${A}/a8631.svg`,
  bell: `${A}/2fae9.svg`,
  shield: `${A}/44314.svg`,
  people: `${A}/d9517.svg`,
  lock: `${A}/78f77.svg`,
  link: `${A}/a89e5.svg`,
  report: `${A}/995cb.svg`,
  sparkles: `${A}/33afb.svg`,
  info: `${A}/cb700.svg`,
  revoke: `${A}/e204d.svg`,
  success: `${A}/88017.svg`,
  alert: `${A}/5af45.svg`,
  smartphone: `${A}/066e0.svg`,
  key: `${A}/f3aaa.svg`,
  monitor: `${A}/2699d.svg`,
  vault: `${A}/74882.svg`,
  shieldRecovery: `${A}/24708.svg`,
  lifeBuoy: `${A}/ae198.svg`,
  logo: `${A}/3359d.png`,
  cloudUpload: `${A}/5ccc7.svg`,
  cloudOff: `${A}/011f7.svg`,
  fileText: `${A}/0d25c.svg`,
  loader: `${A}/bb34f.svg`,
  folderPlus: `${A}/da1b0.svg`,
  hospital: `${A}/ab516.svg`,
  message: `${A}/3f4cb.svg`,
  calendarCheck: `${A}/e92c5.svg`,
  scanCheckin: `${A}/ab0ee.svg`,
  mapPin: `${A}/43d6f.svg`,
  hospitalPhoto: `${A}/90cc8.png`,
  sparklesRecord: `${A}/6e4d8.svg`,
  uploadReview: `${A}/15a7e.svg`,
  camera: `${A}/edee7.svg`,
  scanDocument: `${A}/92f45.svg`,
  pencil: `${A}/ae316.svg`,
  careMapPin: `${A}/6e377.svg`,
  recordStethoscope: `${A}/ea920.svg`,
  recordPrescription: `${A}/d2f09.svg`,
  recordLab: `${A}/a9966.svg`,
  designCheck: `${A}/5a3f7.svg`,
  emergencyQr: `${A}/75480.svg`,
  emergencyPhone: `${A}/ba2c1.svg`,
  emergencyPulse: `${A}/d9c75.svg`,
  passportGlobe: `${A}/7d380.svg`,
  passportLock: `${A}/b88af.svg`,
  activityEye: `${A}/9bd34.svg`,
  activityShieldX: `${A}/137eb.svg`,
  activityList: `${A}/212b7.svg`,
}

function Icon({ src, size = 20 }: { src: string; size?: number }) {
  return (
    <img alt="" className="shrink-0" height={size} src={src} width={size} />
  )
}

function Badge({
  children,
  tone = "blue",
}: {
  children: React.ReactNode
  tone?: "blue" | "red" | "amber"
}) {
  const color =
    tone === "red"
      ? "bg-[#faedea] text-[#af4540]"
      : tone === "amber"
        ? "bg-[#fbf2e3] text-[#936020]"
        : "bg-[#edf2fa] text-[#031f50]"
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${color}`}
    >
      {children}
    </span>
  )
}

function Card({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  const backgroundClass = className.includes("bg-") ? "" : "bg-white"
  const borderClass = className.includes("border-[")
    ? ""
    : "border-[#dae2ee]"
  const interactiveClass = onClick
    ? "mobile-card-press cursor-pointer hover:border-[#b9ccf0] active:scale-[0.985] transition-all duration-150 select-none shadow-xs"
    : ""
  return (
    <div
      className={`w-full rounded-[20px] border p-[18px] text-left ${backgroundClass} ${borderClass} ${interactiveClass} ${className}`}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  )
}

function SectionTitle({
  children,
  action,
  onAction,
}: {
  children: React.ReactNode
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[17px] font-bold text-[#031f50]">{children}</h2>
      {action && (
        <button
          onClick={onAction}
          className="mobile-tap text-xs font-semibold text-[#24518c] active:opacity-75 transition-opacity"
        >
          {action}
        </button>
      )}
    </div>
  )
}

function Row({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: string
  title: string
  detail: string
  onClick?: () => void
}) {
  const Tag = onClick ? "button" : "div"
  return (
    <Tag
      className={`flex w-full items-center gap-3 text-left ${
        onClick ? "mobile-tap cursor-pointer active:scale-[0.99] select-none" : ""
      }`}
      onClick={onClick}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#edf2fa] transition-transform">
        <Icon size={20} src={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#031f50]">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-[1.45] text-[#53657c]">
          {detail}
        </span>
      </span>
      {onClick && <Icon size={16} src={icons.chevron} />}
    </Tag>
  )
}

function Guidance({
  title,
  children,
  tone = "blue",
}: {
  title: string
  children: React.ReactNode
  tone?: "blue" | "amber"
}) {
  return (
    <div
      className={`flex gap-2.5 rounded-[14px] p-3.5 text-[13px] leading-[1.45] ${
        tone === "amber"
          ? "bg-[#fbf2e3] text-[#936020]"
          : "bg-[#edf2fa] text-[#173b71]"
      }`}
    >
      <Icon src={tone === "amber" ? icons.alert : icons.shield} size={19} />
      <div>
        <p className="font-semibold">{title}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  )
}

function PrimaryButton({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode
  onClick?: () => void
  danger?: boolean
}) {
  return (
    <button
      className={`mobile-tap min-h-[50px] w-full rounded-[14px] px-4 text-sm font-semibold text-white shadow-xs active:shadow-none active:scale-[0.97] transition-all duration-150 ${
        danger ? "bg-[#af4540] active:bg-[#8f3833]" : "bg-[#031f50] active:bg-[#021538]"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      className="mobile-tap min-h-[50px] w-full rounded-[14px] border border-[#dae2ee] bg-white px-4 text-sm font-semibold text-[#031f50] active:scale-[0.97] active:bg-[#f1f5f9] transition-all duration-150"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function triggerHaptic(type: "light" | "medium" | "heavy" | "success" = "light") {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    try {
      if (type === "light") navigator.vibrate(8)
      else if (type === "medium") navigator.vibrate(16)
      else if (type === "heavy") navigator.vibrate(28)
      else if (type === "success") navigator.vibrate([10, 30, 15])
    } catch {
      // ignore
    }
  }
}

function ToastNotification({
  message,
  onDismiss,
}: {
  message: string | null
  onDismiss: () => void
}) {
  if (!message) return null
  return (
    <div className="absolute top-16 inset-x-4 z-50 flex justify-center pointer-events-none">
      <div className="animate-toast-pop flex items-center gap-2.5 rounded-full bg-[#031f50] px-4 py-2.5 text-xs font-semibold text-white shadow-xl border border-white/20 pointer-events-auto select-none">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-[11px] font-bold">
          ✓
        </span>
        <span className="truncate max-w-[280px]">{message}</span>
        <button
          onClick={() => {
            triggerHaptic("light")
            onDismiss()
          }}
          className="ml-1 text-slate-300 hover:text-white text-xs font-bold"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function BottomSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const [dragY, setDragY] = useState(0)
  const touchStartY = useRef(0)
  const isDragging = useRef(false)

  if (!isOpen) return null

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    isDragging.current = true
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return
    const deltaY = e.touches[0].clientY - touchStartY.current
    if (deltaY > 0) {
      setDragY(deltaY)
    }
  }

  const handleTouchEnd = () => {
    isDragging.current = false
    if (dragY > 70) {
      triggerHaptic("light")
      onClose()
    }
    setDragY(0)
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-300 select-none">
      {/* Backdrop tap to dismiss */}
      <div
        className="flex-1 w-full"
        onClick={() => {
          triggerHaptic("light")
          onClose()
        }}
      />

      {/* Slide-up Sheet */}
      <div
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragY === 0 ? "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)" : "none",
        }}
        className="animate-sheet-up w-full bg-white rounded-t-[28px] border-t border-slate-200/90 shadow-2xl p-5 pb-8 max-h-[88%] flex flex-col"
      >
        {/* Grab Handle */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="cursor-grab active:cursor-grabbing py-2 -mt-2 mb-2 flex justify-center touch-none select-none"
        >
          <div className="h-1.5 w-12 rounded-full bg-slate-300 transition-colors hover:bg-slate-400" />
        </div>

        {/* Header */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex items-start justify-between mb-4 touch-none select-none"
        >
          <div>
            <h3 className="text-lg font-bold text-[#031f50] leading-tight">{title}</h3>
            {subtitle && <p className="text-xs text-[#53657c] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={() => {
              triggerHaptic("light")
              onClose()
            }}
            aria-label="Close sheet"
            className="mobile-tap size-8 rounded-full bg-[#edf2fa] flex items-center justify-center text-slate-500 hover:text-[#031f50] active:scale-90 text-sm font-bold transition-transform"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Sheet Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain pr-1">
          {children}
        </div>
      </div>
    </div>
  )
}

function FilterBottomSheet({
  isOpen,
  onClose,
  onApply,
}: {
  isOpen: boolean
  onClose: () => void
  onApply: (filter: string) => void
}) {
  const [selectedType, setSelectedType] = useState("All")
  const [selectedPeriod, setSelectedPeriod] = useState("All time")
  const [selectedSource, setSelectedSource] = useState("All")

  const types = ["All", "Laboratory", "Prescriptions", "Imaging", "Vaccines", "Procedures"]
  const periods = ["All time", "Past 30 days", "Past 6 months", "Past year"]
  const sources = ["All", "Verified Clinic", "Patient Added"]

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Filter health records"
      subtitle="Refine by clinical category, date or source"
    >
      <div className="space-y-4 text-left">
        <div>
          <label className="block text-xs font-bold text-[#031f50] mb-2 uppercase tracking-wider">
            Record Type
          </label>
          <div className="flex flex-wrap gap-2">
            {types.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`mobile-tap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  selectedType === type
                    ? "bg-[#031f50] text-white shadow-xs"
                    : "bg-[#edf2fa] text-[#031f50] hover:bg-[#e2eaf5]"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#031f50] mb-2 uppercase tracking-wider">
            Time Period
          </label>
          <div className="flex flex-wrap gap-2">
            {periods.map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`mobile-tap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  selectedPeriod === period
                    ? "bg-[#031f50] text-white shadow-xs"
                    : "bg-[#edf2fa] text-[#031f50] hover:bg-[#e2eaf5]"
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#031f50] mb-2 uppercase tracking-wider">
            Verification Source
          </label>
          <div className="flex flex-wrap gap-2">
            {sources.map((source) => (
              <button
                key={source}
                onClick={() => setSelectedSource(source)}
                className={`mobile-tap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  selectedSource === source
                    ? "bg-[#031f50] text-white shadow-xs"
                    : "bg-[#edf2fa] text-[#031f50] hover:bg-[#e2eaf5]"
                }`}
              >
                {source}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 flex gap-2.5">
          <button
            onClick={() => {
              setSelectedType("All")
              setSelectedPeriod("All time")
              setSelectedSource("All")
            }}
            className="mobile-tap flex-1 py-3 rounded-xl border border-[#dae2ee] bg-white text-xs font-bold text-[#031f50]"
          >
            Reset
          </button>
          <button
            onClick={() => {
              onApply(selectedType)
              onClose()
            }}
            className="mobile-tap flex-2 py-3 rounded-xl bg-[#031f50] text-xs font-bold text-white shadow-sm"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

function ShareConsentBottomSheet({
  isOpen,
  onClose,
  onShare,
}: {
  isOpen: boolean
  onClose: () => void
  onShare: (doctor: string) => void
}) {
  const [selectedDoctor, setSelectedDoctor] = useState("Dr Amaka Bello (Cardiologist)")
  const [selectedScope, setSelectedScope] = useState("Full Health Records")
  const [selectedDuration, setSelectedDuration] = useState("24 Hours")

  const doctors = [
    "Dr Amaka Bello (Cardiologist)",
    "Lagoon Hospital (Ikeja Facility)",
    "SYNLAB Diagnostics (Victoria Island)",
  ]
  const scopes = ["Full Health Records", "Emergency Summary Only", "Recent Labs (30d)"]
  const durations = ["24 Hours", "7 Days", "30 Days", "Revocable Anytime"]

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Share clinical consent"
      subtitle="Grant temporary, encrypted access to healthcare providers"
    >
      <div className="space-y-4 text-left">
        <div>
          <label className="block text-xs font-bold text-[#031f50] mb-2 uppercase tracking-wider">
            Recipient Care Provider
          </label>
          <div className="space-y-1.5">
            {doctors.map((doc) => (
              <button
                key={doc}
                onClick={() => setSelectedDoctor(doc)}
                className={`mobile-tap w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs font-semibold transition-all ${
                  selectedDoctor === doc
                    ? "border-[#24518c] bg-[#eef4ff] text-[#031f50]"
                    : "border-[#dae2ee] bg-white text-[#53657c]"
                }`}
              >
                <span>{doc}</span>
                {selectedDoctor === doc && (
                  <span className="size-4 rounded-full bg-[#031f50] text-white flex items-center justify-center text-[10px]">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#031f50] mb-2 uppercase tracking-wider">
            Access Scope
          </label>
          <div className="flex flex-wrap gap-2">
            {scopes.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedScope(s)}
                className={`mobile-tap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  selectedScope === s
                    ? "bg-[#031f50] text-white"
                    : "bg-[#edf2fa] text-[#031f50]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#031f50] mb-2 uppercase tracking-wider">
            Duration
          </label>
          <div className="grid grid-cols-2 gap-2">
            {durations.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDuration(d)}
                className={`mobile-tap p-2.5 rounded-xl text-center text-xs font-semibold transition-all ${
                  selectedDuration === d
                    ? "bg-[#031f50] text-white shadow-xs"
                    : "border border-[#dae2ee] bg-white text-[#031f50]"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => {
              onShare(selectedDoctor)
              onClose()
            }}
            className="mobile-tap w-full py-3.5 rounded-xl bg-gradient-to-r from-[#24518c] to-[#031f50] text-xs font-bold text-white shadow-md flex items-center justify-center gap-2"
          >
            <span>🔐</span>
            <span>Authorize & Generate Access Pass</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

function EmergencyQrBottomSheet({
  isOpen,
  onClose,
  onCopy,
}: {
  isOpen: boolean
  onClose: () => void
  onCopy: () => void
}) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Emergency Medical Pass"
      subtitle="Critical health data accessible without device unlock"
    >
      <div className="space-y-4 text-center">
        {/* Scannable Emergency QR Box */}
        <div className="mx-auto w-48 h-48 rounded-2xl bg-white p-3 border-2 border-[#031f50] shadow-md flex flex-col items-center justify-center relative">
          <img
            src={icons.emergencyQr}
            alt="Emergency QR"
            className="size-36 object-contain"
          />
          <div className="absolute top-2 right-2 flex size-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
          </div>
        </div>

        {/* Patient Vitals Quick Row */}
        <div className="grid grid-cols-3 gap-2 text-left">
          <div className="p-2.5 rounded-xl bg-[#edf2fa]">
            <p className="text-[10px] uppercase font-bold text-[#53657c]">Blood</p>
            <p className="text-base font-bold text-[#031f50]">O+</p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#edf2fa]">
            <p className="text-[10px] uppercase font-bold text-[#53657c]">Genotype</p>
            <p className="text-base font-bold text-[#031f50]">AA</p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#fbeae8]">
            <p className="text-[10px] uppercase font-bold text-[#af4540]">Allergy</p>
            <p className="text-xs font-bold text-[#af4540] truncate">Penicillin</p>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="p-3 rounded-xl border border-[#dae2ee] bg-white flex items-center justify-between text-left">
          <div>
            <p className="text-[11px] text-[#53657c] font-medium">Next of Kin Contact</p>
            <p className="text-xs font-bold text-[#031f50]">Chidi Okafor (Spouse)</p>
          </div>
          <a
            href="tel:+2348031234567"
            className="mobile-tap px-3 py-1.5 rounded-full bg-[#10b981] text-white text-xs font-bold flex items-center gap-1 shadow-xs"
          >
            <span>📞</span> Call
          </a>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={onCopy}
            className="mobile-tap py-3 rounded-xl border border-[#dae2ee] bg-white text-xs font-bold text-[#031f50] flex items-center justify-center gap-1.5"
          >
            <span>📋</span> Copy Link
          </button>
          <button
            onClick={() => {
              onCopy()
              onClose()
            }}
            className="mobile-tap py-3 rounded-xl bg-[#031f50] text-xs font-bold text-white shadow-xs flex items-center justify-center gap-1.5"
          >
            <span>📲</span> Apple Wallet
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

function SkeletonRecords() {
  return (
    <div className="space-y-3 py-1 select-none">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="rounded-[20px] border border-[#dae2ee] bg-white p-4 shadow-xs space-y-3 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl skeleton-shimmer shrink-0" />
              <div className="space-y-2">
                <div className="h-4 w-36 rounded-md skeleton-shimmer" />
                <div className="h-3 w-24 rounded-md skeleton-shimmer" />
              </div>
            </div>
            <div className="h-5 w-20 rounded-full skeleton-shimmer" />
          </div>
          <div className="h-3.5 w-4/5 rounded-md skeleton-shimmer" />
          <div className="flex gap-2 pt-1">
            <div className="h-5 w-20 rounded-md skeleton-shimmer" />
            <div className="h-5 w-28 rounded-md skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  )
}

function PullToRefreshControl({
  isRefreshing,
  onRefresh,
  lastUpdated,
}: {
  isRefreshing: boolean
  onRefresh: () => void
  lastUpdated?: string
}) {
  return (
    <div className="flex items-center justify-between px-1 mb-2 select-none">
      <div className="flex items-center gap-1.5 text-[11px] text-[#718096]">
        <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>{lastUpdated ? `Synced ${lastUpdated}` : "Secure Vault Connected"}</span>
      </div>
      <button
        onClick={() => {
          triggerHaptic("medium")
          onRefresh()
        }}
        disabled={isRefreshing}
        className={`mobile-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
          isRefreshing
            ? "border-blue-300 bg-blue-50 text-blue-700 cursor-wait shadow-2xs"
            : "border-[#dae2ee] bg-white text-[#24518c] hover:bg-[#edf2fa] active:scale-95 shadow-2xs"
        }`}
      >
        <span className={`inline-block text-xs ${isRefreshing ? "animate-spin" : ""}`}>
          {isRefreshing ? "🔄" : "⟳"}
        </span>
        <span>{isRefreshing ? "Updating vault..." : "Pull to sync"}</span>
      </button>
    </div>
  )
}

function Home({
  go,
  careStage,
  openShare,
  openEmergency,
}: {
  go: (screen: Screen) => void
  careStage: "scheduled" | "booked" | "checkedIn"
  openShare?: () => void
  openEmergency?: () => void
}) {
  return (
    <div className="stack">
      <Card className="welliid-card border-[#031f50] bg-[#031f50] p-5 text-white shadow-lg">
        <div className="flex items-center justify-between text-[11px] font-medium tracking-[0.08em] text-[#e0e9f8]">
          <span>YOUR WELLIID</span>
          <Icon src={icons.fingerprint} size={28} />
        </div>
        <p className="mt-5 text-[27px] font-semibold tracking-[0.02em]">
          WR-4821-0936
        </p>
        <p className="mt-3 text-xs leading-[1.45] text-[#e0e9f8]">
          One patient. One trusted record.
          <br />
          Accessible when it matters.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white">
              Synced today, 08:42
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white">
              Available offline
            </span>
          </div>
          {openEmergency && (
            <button
              onClick={openEmergency}
              className="mobile-tap inline-flex items-center gap-1.5 rounded-full bg-red-500/90 hover:bg-red-500 active:scale-95 text-white px-3 py-1.5 text-[11px] font-bold shadow-md transition-all select-none"
            >
              <span>🚨</span>
              <span>Emergency Pass</span>
            </button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: icons.calendar, label: "Appointments", action: () => go("bookingTime") },
          { icon: icons.send, label: "Share record", action: openShare ? openShare : () => go("consentExpanded") },
          { icon: icons.scan, label: "Emergency QR", action: openEmergency ? openEmergency : () => go("emergencyQr") },
          { icon: icons.lab, label: "Lab results", action: () => go("reports") },
        ].map((item) => (
          <button
            className="mobile-tap flex flex-col items-center gap-2 text-center active:scale-95 select-none"
            key={item.label}
            onClick={item.action}
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[#edf2fa] hover:bg-[#e2eaf5] transition-colors shadow-2xs">
              <Icon src={item.icon} size={23} />
            </span>
            <span className="text-[10px] font-semibold leading-tight text-[#031f50]">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <Card onClick={() => go("careDiscovery")}>
        <Row
          detail="Participating providers, appointments, labs and pharmacies"
          icon={icons.stethoscope}
          title="Find care near you"
        />
      </Card>

      <SectionTitle>Your health at a glance</SectionTitle>
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold text-[#031f50]">O+</p>
            <p className="text-xs text-[#53657c]">Blood group</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#031f50]">AA</p>
            <p className="text-xs text-[#53657c]">Genotype</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="red">Penicillin allergy</Badge>
          <Badge>Hypertension</Badge>
        </div>
        <p className="mt-3 text-xs text-[#53657c]">
          Alert: penicillin caused a rash · Provider confirmed
        </p>
      </Card>

      <SectionTitle action="View timeline" onAction={() => go("timeline")}>Next in your care</SectionTitle>
      <Card className="space-y-4">
        <Row
          detail={
            careStage === "checkedIn"
              ? "Checked in · Waiting for triage at Lagoon Hospital"
              : "Mon, 5 Oct · 10:30 AM · Lagoon Hospital, Ikeja"
          }
          icon={icons.calendar}
          title={
            careStage === "checkedIn"
              ? "Visit with Dr Amaka Bello"
              : careStage === "booked"
                ? "Booked · Follow-up with Dr Amaka Bello"
                : "Follow-up with Dr Amaka Bello"
          }
          onClick={() =>
            go(
              careStage === "checkedIn"
                ? "careJourney"
                : careStage === "booked"
                  ? "bookingConfirmed"
                  : "bookingTime",
            )
          }
        />
        <div className="h-px bg-[#dae2ee]" />
        <Row
          detail="Next dose today at 8:00 PM · After food"
          icon={icons.pill}
          title="Ferrous sulfate · 200 mg"
          onClick={() => go("medications")}
        />
      </Card>

      <SectionTitle action="View all" onAction={() => go("reports")}>Recent record activity</SectionTitle>
      <Card onClick={() => go("reports")}>
        <Row
          detail="SYNLAB Ikeja · 29 Sep 2026"
          icon={icons.lab}
          title="Full blood count added"
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <Badge>Verified provider</Badge>
          <span className="text-[11px] text-[#53657c]">
            Shared with Dr Bello · 24 hours
          </span>
        </div>
      </Card>
    </div>
  )
}

const recordCategories = [
  [icons.stethoscope, "Medical", "4 records"],
  [icons.lab, "Laboratory", "6 reports"],
  [icons.imaging, "Imaging", "2 reports"],
  [icons.pill, "Medications", "2 current"],
  [icons.fileHeart, "Prescriptions", "3 records"],
  [icons.syringe, "Vaccinations", "3 records"],
  [icons.allergy, "Allergies", "1 confirmed"],
  [icons.activity, "Procedures", "1 record"],
  [icons.files, "Documents", "2 files"],
]

function Records({
  go,
  recordAdded,
  openFilter,
  showToast,
  activeFilter = "All",
  onClearFilter,
}: {
  go: (screen: Screen) => void
  recordAdded: boolean
  openFilter?: () => void
  showToast?: (msg: string) => void
  activeFilter?: string
  onClearFilter?: () => void
}) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState("just now")
  const [searchQuery, setSearchQuery] = useState("")

  const handleRefresh = () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    triggerHaptic("medium")
    setTimeout(() => {
      setIsRefreshing(false)
      setLastRefreshed("just now")
      triggerHaptic("success")
      if (showToast) showToast("Health records synchronized from secure vault ✓")
    }, 1200)
  }

  const displayedCategories = recordCategories.filter(([_, label]) => {
    const matchesFilter =
      activeFilter === "All" ||
      label.toLowerCase().includes(activeFilter.toLowerCase()) ||
      activeFilter.toLowerCase().includes(label.toLowerCase())
    const matchesSearch =
      !searchQuery.trim() ||
      label.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div className="stack">
      {/* Search and Filter Row */}
      <div className="flex items-center gap-2">
        <label className="flex flex-1 h-[52px] items-center gap-3 rounded-[14px] border border-[#dae2ee] bg-white px-4 shadow-2xs">
          <Icon src={icons.search} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm outline-none placeholder:text-[#718096]"
            placeholder="Search a test, medicine or provider"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          )}
        </label>
        {openFilter && (
          <button
            onClick={() => {
              triggerHaptic("light")
              openFilter()
            }}
            className="mobile-tap relative flex size-[52px] shrink-0 items-center justify-center rounded-[14px] border border-[#dae2ee] bg-white text-[#031f50] hover:bg-[#edf2fa] active:scale-95 transition-all shadow-2xs"
            title="Filter records"
          >
            <Icon src={icons.filter} size={20} />
            {activeFilter !== "All" && (
              <span className="absolute top-2.5 right-2.5 size-2.5 rounded-full bg-[#2563eb] ring-2 ring-white" />
            )}
          </button>
        )}
      </div>

      {activeFilter !== "All" && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#eef4ff] border border-[#24518c]/30 text-xs text-[#031f50]">
          <div className="flex items-center gap-2">
            <span className="text-[#53657c]">Category filter:</span>
            <span className="font-bold px-2.5 py-0.5 rounded-full bg-[#031f50] text-white text-[11px]">
              {activeFilter}
            </span>
          </div>
          <button
            onClick={() => {
              triggerHaptic("light")
              if (onClearFilter) onClearFilter()
            }}
            className="mobile-tap text-xs font-bold text-[#24518c] hover:underline"
          >
            Reset ✕
          </button>
        </div>
      )}

      {/* Pull To Refresh Bar */}
      <PullToRefreshControl
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        lastUpdated={lastRefreshed}
      />

      {isRefreshing ? (
        <SkeletonRecords />
      ) : (
        <>
          <Card>
            <Row
              detail="Ask questions using only the records you choose"
              icon={icons.sparklesRecord}
              title="Understand my records"
              onClick={() => go("recordChat")}
            />
          </Card>
          {recordAdded && (
            <Guidance title="Full blood count added">
              Your reviewed upload is now saved as Patient Added. The original file
              and AI extraction label were retained.
            </Guidance>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4" onClick={() => go("timeline")}>
              <Icon src={icons.history} />
              <p className="mt-4 text-sm font-semibold text-[#031f50]">
                Health timeline →
              </p>
              <p className="mt-2 text-xs text-[#53657c]">Your story over time</p>
            </Card>
            <Card className="p-4" onClick={() => go("healthPassport")}>
              <Icon src={icons.book} />
              <p className="mt-4 text-sm font-semibold text-[#031f50]">
                Health passport →
              </p>
              <p className="mt-2 text-xs text-[#53657c]">A portable summary</p>
            </Card>
          </div>
          <SectionTitle>Browse your records</SectionTitle>
          {displayedCategories.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-white border border-dashed border-slate-300">
              <p className="text-sm font-semibold text-slate-700">No matching categories found</p>
              <p className="text-xs text-slate-500 mt-1">Try resetting the filter or search query</p>
              <button
                onClick={() => {
                  setSearchQuery("")
                  if (onClearFilter) onClearFilter()
                }}
                className="mobile-tap mt-3 px-3 py-1.5 rounded-full bg-[#edf2fa] text-xs font-semibold text-[#031f50]"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {displayedCategories.map(([icon, label, count]) => (
                <Card
                  className="min-h-[124px] p-4"
                  key={label}
                  onClick={
                    label === "Laboratory"
                      ? () => go("reports")
                      : label === "Medications"
                        ? () => go("medications")
                        : label === "Medical"
                          ? () => go("timeline")
                          : undefined
                  }
                >
                  <Icon src={icon} />
                  <p className="mt-4 text-sm font-semibold text-[#031f50]">{label}</p>
                  <p className="mt-1 text-xs text-[#53657c]">{count}</p>
                </Card>
              ))}
            </div>
          )}
          <SectionTitle>Know where it came from</SectionTitle>
          <Card className="space-y-3 text-xs text-[#53657c]">
            <p>
              <Badge>Verified provider</Badge>{" "}
              <span className="ml-2">Issued by a participating care provider</span>
            </p>
            <p>
              <Badge>Patient Added</Badge>{" "}
              <span className="ml-2">Information or files you added</span>
            </p>
            <p>
              <Badge>Imported</Badge>{" "}
              <span className="ml-2">Transferred from an external record</span>
            </p>
          </Card>
          <Guidance title="1 document needs your review" tone="amber">
            AI extracted your uploaded report. Confirm the fields before adding it.
          </Guidance>
          <PrimaryButton onClick={() => go("uploadReview")}>
            Upload a health document
          </PrimaryButton>
          <SectionTitle>Connection & reliability</SectionTitle>
          <Card className="space-y-4">
            <Row
              detail="See saved information and queued work"
              icon={icons.cloudOff}
              title="Offline view"
              onClick={() => go("offline")}
            />
            <div className="h-px bg-[#dae2ee]" />
            <Row
              detail="Loading state for laboratory records"
              icon={icons.loader}
              title="Reports are loading"
              onClick={() => go("labsLoading")}
            />
            <div className="h-px bg-[#dae2ee]" />
            <Row
              detail="Review a preserved local upload draft"
              icon={icons.cloudOff}
              title="Interrupted upload"
              onClick={() => go("uploadFailed")}
            />
          </Card>
        </>
      )}
    </div>
  )
}

const timelineItems = [
  [
    "30 Sep 2026",
    icons.pill,
    "Prescription dispensed",
    "HealthPlus, Ikeja · Pharmacist T. Aina",
    "Ferrous sulfate 200 mg · 30 tablets",
  ],
  [
    "29 Sep 2026",
    icons.lab,
    "Full blood count",
    "SYNLAB Ikeja · Report SL-290926-184",
    "Haemoglobin 10.2 g/dL · Lab reference: 12.0–15.5 g/dL",
  ],
  [
    "28 Sep 2026",
    icons.fileHeart,
    "Prescription issued",
    "Dr Amaka Bello · Lagoon Hospital",
    "Ferrous sulfate 200 mg once daily · Amlodipine 5 mg continued",
  ],
  [
    "28 Sep 2026",
    icons.stethoscope,
    "Follow-up consultation",
    "Dr Amaka Bello · Lagoon Hospital",
    "Hypertension review · Full blood count requested",
  ],
  [
    "18 Jun 2026",
    icons.syringe,
    "Tetanus booster",
    "Lagoon Hospital · Nurse E. Adeyemi",
    "Td vaccine · Dose recorded",
  ],
]

function Timeline({
  go,
  openFilter,
  showToast,
  activeFilter = "All",
  onClearFilter,
}: {
  go: (screen: Screen) => void
  openFilter?: () => void
  showToast?: (msg: string) => void
  activeFilter?: string
  onClearFilter?: () => void
}) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState("just now")

  const handleRefresh = () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    triggerHaptic("medium")
    setTimeout(() => {
      setIsRefreshing(false)
      setLastRefreshed("just now")
      triggerHaptic("success")
      if (showToast) showToast("Timeline synchronized from clinic records ✓")
    }, 1200)
  }

  const displayedTimeline = timelineItems.filter(([_, __, title, source, detail]) => {
    if (activeFilter === "All") return true
    const q = activeFilter.toLowerCase()
    return (
      title.toLowerCase().includes(q) ||
      source.toLowerCase().includes(q) ||
      detail.toLowerCase().includes(q)
    )
  })

  return (
    <div className="stack">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {["All records", "2026", "Filters"].map((item) => (
          <button
            className={`mobile-tap whitespace-nowrap rounded-full border border-[#dae2ee] px-3.5 py-1.5 text-xs font-semibold active:scale-95 transition-all select-none ${
              item === "Filters"
                ? "bg-[#031f50] text-white flex items-center gap-1.5 shadow-2xs relative"
                : "bg-white text-[#031f50]"
            }`}
            key={item}
            onClick={() => {
              triggerHaptic("light")
              if (item === "Filters" && openFilter) openFilter()
            }}
          >
            {item === "Filters" && <Icon src={icons.filter} size={14} />}
            <span>{item}</span>
            {item === "Filters" && activeFilter !== "All" && (
              <span className="size-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        ))}
      </div>

      {activeFilter !== "All" && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#eef4ff] border border-[#24518c]/30 text-xs text-[#031f50]">
          <div className="flex items-center gap-2">
            <span className="text-[#53657c]">Timeline filter:</span>
            <span className="font-bold px-2.5 py-0.5 rounded-full bg-[#031f50] text-white text-[11px]">
              {activeFilter}
            </span>
          </div>
          <button
            onClick={() => {
              triggerHaptic("light")
              if (onClearFilter) onClearFilter()
            }}
            className="mobile-tap text-xs font-bold text-[#24518c] hover:underline"
          >
            Reset ✕
          </button>
        </div>
      )}

      <PullToRefreshControl
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        lastUpdated={lastRefreshed}
      />

      <p className="text-xs leading-[1.45] text-[#53657c]">
        Filter by provider, doctor, lab, pharmacy, medicine, diagnosis, date or
        record type.
      </p>

      {isRefreshing ? (
        <SkeletonRecords />
      ) : displayedTimeline.length === 0 ? (
        <div className="p-6 text-center rounded-2xl bg-white border border-dashed border-slate-300">
          <p className="text-sm font-semibold text-slate-700">No events matched this filter</p>
          <p className="text-xs text-slate-500 mt-1">Try resetting the timeline filter</p>
          <button
            onClick={() => {
              if (onClearFilter) onClearFilter()
            }}
            className="mobile-tap mt-3 px-3 py-1.5 rounded-full bg-[#edf2fa] text-xs font-semibold text-[#031f50]"
          >
            Show all timeline events
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedTimeline.map(([date, icon, title, source, detail], index) => (
            <div
              className="grid grid-cols-[30px_1fr] gap-2"
              key={`${date}-${title}`}
            >
              <div className="flex flex-col items-center">
                <span className="flex size-7 items-center justify-center rounded-full bg-[#edf2fa]">
                  <Icon src={icon} size={15} />
                </span>
                {index < displayedTimeline.length - 1 && (
                  <span className="mt-1 w-0.5 flex-1 bg-[#dae2ee]" />
                )}
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold text-[#53657c]">
                  {date}
                </p>
                <Card
                  className="mb-1 p-4"
                  onClick={
                    title === "Full blood count" ? () => go("result") : undefined
                  }
                >
                  <p className="text-sm font-semibold text-[#031f50]">{title}</p>
                  <p className="mt-2 text-xs text-[#53657c]">{source}</p>
                  <p className="mt-3 text-xs leading-[1.45] text-[#173b71]">
                    {detail}
                  </p>
                  <div className="mt-3">
                    <Badge>Verified provider</Badge>
                  </div>
                </Card>
              </div>
            </div>
          ))}
        </div>
      )}
      <Guidance title="Your own symptoms and measurements are Patient Added">
        They never silently rewrite this history.
      </Guidance>
    </div>
  )
}

function Reports({ go }: { go: (screen: Screen) => void }) {
  const reports = [
    [
      "Haemoglobin",
      "12 Aug 2026 · SYNLAB Ikeja",
      "Haemoglobin · 11.1 g/dL",
      "Source not verified",
    ],
    [
      "Lipid profile",
      "18 Jun 2026 · Lagoon Hospital, Ikeja",
      "Transferred from an external record",
      "Imported",
    ],
    [
      "Kidney function",
      "18 Jun 2026 · SYNLAB Ikeja",
      "Issued by the laboratory",
      "Verified provider",
    ],
    [
      "Fasting blood glucose",
      "21 Mar 2026 · Medbury Medical Services",
      "Uploaded by you · source not verified",
      "Patient Added",
    ],
    [
      "Urinalysis",
      "10 Feb 2026 · Lagoon Hospital, Ikeja",
      "Uploaded by you · source not verified",
      "Patient Added",
    ],
  ]
  return (
    <div className="stack">
      <label className="flex h-[52px] items-center gap-3 rounded-[14px] border border-[#dae2ee] bg-white px-4">
        <Icon src={icons.search} />
        <input
          className="w-full bg-transparent text-sm outline-none"
          placeholder="Search a test or provider"
        />
      </label>
      <div className="flex gap-2 overflow-x-auto">
        {["All dates", "Provider", "Source"].map((x) => (
          <button
            className="rounded-full border border-[#dae2ee] bg-white px-3 py-2 text-xs"
            key={x}
          >
            {x}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-sm font-semibold text-[#031f50]">
        <span>6 reports</span>
        <span>Newest first</span>
      </div>
      <Card onClick={() => go("result")}>
        <div className="flex justify-between text-[11px] font-semibold text-[#173b71]">
          <span>LATEST REPORT</span>
          <span>Verified provider</span>
        </div>
        <h2 className="mt-3 text-lg font-bold text-[#031f50]">
          Full blood count
        </h2>
        <p className="mt-1 text-xs text-[#53657c]">
          29 Sep 2026 · SYNLAB Ikeja
        </p>
        <div className="mt-4 rounded-xl bg-[#fbf2e3] p-3">
          <p className="text-sm font-semibold text-[#031f50]">
            Haemoglobin · 10.2 g/dL
          </p>
          <p className="mt-2 text-xs text-[#936020]">
            Below this lab’s range: 12.0–15.5 g/dL
          </p>
          <p className="mt-2 text-xs text-[#53657c]">
            This flag is for haemoglobin, not the whole panel.
          </p>
        </div>
        <PrimaryButton>Open latest report</PrimaryButton>
      </Card>
      <SectionTitle>Earlier reports</SectionTitle>
      {reports.map(([name, date, detail, source]) => (
        <Card className="p-4" key={name}>
          <p className="text-sm font-semibold text-[#031f50]">{name}</p>
          <p className="mt-1 text-xs text-[#53657c]">{date}</p>
          <p className="mt-3 text-xs text-[#53657c]">{detail}</p>
          <div className="mt-3">
            <Badge>{source}</Badge>
          </div>
        </Card>
      ))}
      <Guidance title="Source labels, not a medical assessment">
        Verified provider, Patient Added and Imported describe record
        provenance.
      </Guidance>
    </div>
  )
}

function Result({ go }: { go: (screen: Screen) => void }) {
  const [question, setQuestion] = useState("")
  return (
    <div className="stack">
      <Card>
        <p className="text-[11px] font-semibold text-[#173b71]">
          ASKING ABOUT THIS RESULT
        </p>
        <h2 className="mt-2 text-lg font-bold text-[#031f50]">
          Full blood count · 29 Sep 2026
        </h2>
        <p className="mt-2 text-xs text-[#53657c]">
          SYNLAB Ikeja · SL-290926-184
        </p>
        <p className="mt-4 text-xs text-[#53657c]">Haemoglobin</p>
        <p className="text-2xl font-bold text-[#031f50]">
          10.2 g/dL <Badge tone="amber">Below lab range</Badge>
        </p>
        <p className="mt-2 text-xs text-[#53657c]">
          Laboratory reference range: 12.0–15.5 g/dL
        </p>
      </Card>
      <Guidance title="Only this report, only this chat">
        Only the selected report is used for clinical context. No provider
        receives this conversation.
      </Guidance>
      <div className="ml-auto max-w-[86%] rounded-[14px] bg-[#031f50] p-4 text-sm text-white">
        What does this result mean?
      </div>
      <Card>
        <div className="flex items-center gap-2 text-sm font-semibold text-[#031f50]">
          <Icon src={icons.sparkles} />
          WelliRecord · Result explanation
        </div>
        <p className="mt-4 text-[13px] leading-[1.55] text-[#173b71]">
          Your haemoglobin is 10.2 g/dL. SYNLAB’s reference range is 12.0–15.5
          g/dL, so your value is below this laboratory’s range.
        </p>
        <div className="my-4 h-px bg-[#dae2ee]" />
        <p className="text-[13px] font-semibold text-[#031f50]">
          General education · AI explanation
        </p>
        <p className="mt-2 text-[13px] leading-[1.55] text-[#173b71]">
          Haemoglobin is the oxygen-carrying protein in red blood cells. A
          below-range value alone cannot tell us a diagnosis or cause. Your
          clinician can interpret it with your history and other tests.
        </p>
        <p className="mt-3 text-[11px] text-[#718096]">
          This educational explanation is generated here; it is not part of the
          original laboratory report.
        </p>
      </Card>
      <Card onClick={() => go("reports")}>
        <Row
          detail="SYNLAB Ikeja · Collected 29 Sep 2026"
          icon={icons.report}
          title="Original full blood count"
        />
        <div className="mt-3">
          <Badge>Verified provider</Badge>
        </div>
      </Card>
      <Card>
        <p className="text-[11px] font-semibold text-[#173b71]">
          APPOINTMENT CONTEXT · NOT FROM REPORT
        </p>
        <p className="mt-3 text-sm font-semibold text-[#031f50]">
          Questions for your follow-up
        </p>
        <p className="mt-2 text-xs text-[#53657c]">
          Dr Amaka Bello · 5 Oct 2026, 10:30 AM
        </p>
        <ul className="mt-3 space-y-2 text-xs text-[#173b71]">
          <li>• What does this haemoglobin result mean for me?</li>
          <li>• Do I need any other tests to understand it?</li>
          <li>• When should we check my haemoglobin again?</li>
        </ul>
      </Card>
      <Guidance title="Education, not a diagnosis" tone="amber">
        No diagnosis or medicine change is made here. Discuss this result with
        your clinician.
      </Guidance>
      <form
        className="flex h-14 items-center rounded-[14px] border border-[#dae2ee] bg-white px-4"
        onSubmit={(e) => {
          e.preventDefault()
          setQuestion("")
        }}
      >
        <input
          className="flex-1 bg-transparent text-sm outline-none"
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a follow-up question…"
          value={question}
        />
        <button className="text-xl text-[#031f50]" aria-label="Send question">
          ↑
        </button>
      </form>
    </div>
  )
}

function Medications() {
  const [taken, setTaken] = useState(false)
  return (
    <div className="stack">
      <div className="grid grid-cols-2 rounded-[14px] bg-[#edf2fa] p-1">
        <button className="rounded-[11px] bg-white py-2.5 text-xs font-semibold text-[#031f50]">
          Current · 2
        </button>
        <button className="py-2.5 text-xs text-[#53657c]">Past · 1</button>
      </div>
      <Card className="bg-[#edf2fa]">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold text-[#031f50]">
            This week’s routine
          </p>
          <span className="text-[11px] font-semibold">6 of 7 taken</span>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div className="text-center" key={`${d}-${i}`}>
              <span
                className={`mx-auto flex size-8 items-center justify-center rounded-full ${
                  i === 4 ? "bg-white" : "bg-[#031f50]"
                }`}
              >
                <Icon src={i === 4 ? icons.minus : icons.check} size={15} />
              </span>
              <span className="mt-1 block text-[10px] text-[#53657c]">{d}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-[#53657c]">
          Amlodipine: 6 Taken, 1 Skipped. Self-reported dose logs, not proof of
          use.
        </p>
      </Card>
      <SectionTitle>Today · 3 October</SectionTitle>
      <Card>
        <div className="flex items-center justify-between">
          <Icon src={icons.pill} />
          <Badge tone="amber">8:00 PM reminder</Badge>
        </div>
        <h2 className="mt-4 text-lg font-bold text-[#031f50]">
          Ferrous sulfate · 200 mg
        </h2>
        <p className="mt-3 text-sm leading-[1.45] text-[#173b71]">
          1 tablet by mouth · Once daily
          <br />
          Take after food, as prescribed.
        </p>
        <p className="mt-4 text-xs text-[#53657c]">
          Dr Amaka Bello · 28 Sep 2026
          <br />
          Dispensed: HealthPlus Ikeja · 30 Sep
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            className={`h-12 rounded-xl text-sm font-semibold ${
              taken ? "bg-[#edf2fa] text-[#031f50]" : "bg-[#031f50] text-white"
            }`}
            onClick={() => setTaken(!taken)}
          >
            {taken ? "Undo taken" : "✓  Taken"}
          </button>
          <button className="h-12 rounded-xl border border-[#dae2ee] text-sm font-semibold text-[#031f50]">
            Snooze
          </button>
        </div>
        <button className="mt-3 w-full text-xs font-semibold text-[#53657c]">
          Mark skipped · Add a reason
        </button>
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#031f50]">
            Amlodipine · 5 mg
          </h2>
          <Badge>Taken</Badge>
        </div>
        <p className="mt-3 text-sm text-[#173b71]">
          1 tablet by mouth · Once daily
          <br />
          Take at the same time each morning.
        </p>
        <p className="mt-4 text-xs text-[#53657c]">
          Today’s dose logged at 8:06 AM
        </p>
        <div className="mt-3">
          <Badge>Verified prescription</Badge>
        </div>
      </Card>
      <Guidance title="Safety information, not prescribing advice" tone="amber">
        Penicillin allergy is on your record. Ask your clinician or pharmacist
        before changes.
      </Guidance>
      <Row
        detail="8:00 AM & 8:00 PM · Notifications enabled"
        icon={icons.bell}
        title="Reminder preferences"
      />
    </div>
  )
}

function Profile({
  go,
  onSignOut,
}: {
  go: (screen: Screen) => void
  onSignOut: () => void
}) {
  return (
    <div className="stack">
      <Card>
        <p className="text-[11px] font-semibold text-[#53657c]">MY ACCOUNT</p>
        <h2 className="mt-3 text-xl font-bold">Adaeze Okafor</h2>
        <p className="mt-2 text-sm font-semibold">WR-4821-0936</p>
        <p className="mt-3 text-xs leading-[1.5] text-[#53657c]">
          Female · 34 years · 14 Jun 1992
          <br />
          Lagos, Nigeria
        </p>
      </Card>
      <SectionTitle>Coverage & records</SectionTitle>
      <Card className="space-y-4">
        <Row
          detail="Member RL-209184 · Valid to 31 Dec 2026"
          icon={icons.shield}
          title="Reliance HMO · Active"
        />
        <div className="h-px bg-[#dae2ee]" />
        <Row
          detail="4 participating providers · Last synced 08:42"
          icon={icons.link}
          title="24 linked health records"
          onClick={() => go("records")}
        />
        <div>
          <Badge>Consent controlled · 2 active grants</Badge>
        </div>
      </Card>
      <Guidance title="Your WelliID is not a national ID">
        NIN linkage is optional and not yet linked. We only request it where
        appropriate.
      </Guidance>
      <SectionTitle action="Review">Emergency basics</SectionTitle>
      <Card>
        <p className="text-sm font-semibold text-[#031f50]">
          Penicillin allergy · Hypertension
        </p>
        <p className="mt-3 text-xs text-[#53657c]">
          Contact: Chidi Okafor · Husband
          <br />
          +234 803 555 0142
        </p>
        <button
          className="mt-4 text-xs font-semibold text-[#24518c]"
          onClick={() => go("emergencyQr")}
        >
          Review emergency access →
        </button>
      </Card>
      <Card className="space-y-4">
        <Row
          detail="Separate identities. Limited access, with expiry."
          icon={icons.people}
          title="Family & caregivers"
        />
        <Row
          detail="Protect your identity and manage permissions"
          icon={icons.lock}
          title="Security & privacy"
          onClick={() => go("lostPhone")}
        />
      </Card>
      <SectionTitle>Account & accessibility</SectionTitle>
      <Card className="space-y-4">
        <Row
          detail="Language, larger text and reading support"
          icon={icons.book}
          title="Language & accessibility"
          onClick={() => go("preferences")}
        />
        <div className="h-px bg-[#dae2ee]" />
        <Row
          detail="Recover access or review trusted sessions"
          icon={icons.key}
          title="Account recovery"
          onClick={() => go("recoverAccount")}
        />
      </Card>
      <PrimaryButton onClick={() => go("consentExpanded")}>
        Open Consent Center
      </PrimaryButton>
      <SecondaryButton onClick={onSignOut}>Sign out</SecondaryButton>
    </div>
  )
}

function Outcome({
  kind,
  go,
  onConfirmRevoke,
}: {
  kind: "revoke" | "shared"
  go: (screen: Screen) => void
  onConfirmRevoke?: () => void
}) {
  const revoke = kind === "revoke"
  return (
    <div className="stack">
      <div
        className={`flex flex-col items-center rounded-[20px] p-[22px] text-center ${
          revoke ? "bg-[#faedea]" : "bg-[#edf2fa]"
        }`}
      >
        <span
          className={`flex size-[60px] items-center justify-center rounded-full ${
            revoke ? "bg-[#af4540]" : "bg-[#031f50]"
          }`}
        >
          <Icon src={revoke ? icons.revoke : icons.success} size={28} />
        </span>
        <h2 className="mt-3 text-[22px] font-bold leading-[1.3] text-[#031f50]">
          {revoke ? "End future access" : "Shared for 24 hours"}
        </h2>
        <p className="mt-3 text-sm leading-[1.45] text-[#53657c]">
          {revoke
            ? "This choice applies to consent C-1031 only."
            : "You continued with your selected duration. Access has not been extended."}
        </p>
      </div>
      <Card>
        <Badge>Active · Consent C-1031</Badge>
        <p className="mt-4 text-sm font-semibold text-[#031f50]">
          {revoke
            ? "Dr Amaka Bello · Verified provider"
            : "Treatment · Follow-up review"}
        </p>
        <p className="mt-3 text-sm leading-[1.45] text-[#173b71]">
          Laboratory
          <br />
          Medications & prescriptions
          <br />
          Medical consultations only
        </p>
        <p className="mt-3 text-xs leading-[1.45] text-[#53657c]">
          Granted 3 Oct 2026, 9:41 AM
          <br />
          Expires 4 Oct 2026, 9:41 AM · Africa/Lagos
        </p>
      </Card>
      <Guidance
        title={
          revoke
            ? "What revocation means"
            : "This does not cover your 5 Oct visit"
        }
        tone="amber"
      >
        {revoke
          ? "After online confirmation, future eligible access ends immediately. Past views cannot be undone."
          : "Your 10:30 AM appointment is after expiry. Change the duration only if you choose to."}
      </Guidance>
      {revoke ? (
        <PrimaryButton danger onClick={onConfirmRevoke}>
          Confirm revoke
        </PrimaryButton>
      ) : (
        <PrimaryButton>Manage duration</PrimaryButton>
      )}
      <SecondaryButton onClick={() => go("consentExpanded")}>
        {revoke ? "Cancel · Keep access" : "View consent"}
      </SecondaryButton>
      <p className="text-center text-xs text-[#53657c]">
        {revoke
          ? "Restoring access will require a new consent choice."
          : "All accesses are logged. You can revoke eligible access in Consent Center."}
      </p>
    </div>
  )
}

function ScreenIntro({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string
  title: string
  copy: string
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#53657c]">{eyebrow}</p>
      <h2 className="mt-1 text-[27px] font-bold leading-[1.2] text-[#031f50]">
        {title}
      </h2>
      <p className="mt-1 text-sm leading-[1.45] text-[#53657c]">{copy}</p>
    </div>
  )
}

function Choice({
  checked,
  title,
  detail,
  onClick,
}: {
  checked: boolean
  title: string
  detail?: string
  onClick?: () => void
}) {
  return (
    <button
      className="flex w-full items-start gap-3 text-left"
      onClick={onClick}
      type="button"
    >
      <span
        className={`mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-md border ${
          checked
            ? "border-[#031f50] bg-[#031f50] text-white"
            : "border-[#cbd7e8] bg-white"
        }`}
      >
        {checked ? <Icon size={14} src={icons.designCheck} /> : ""}
      </span>
      <span>
        <span className="block text-sm font-semibold text-[#031f50]">
          {title}
        </span>
        {detail && (
          <span className="mt-1 block text-xs leading-[1.45] text-[#53657c]">
            {detail}
          </span>
        )}
      </span>
    </button>
  )
}

function LostPhone({ go }: { go: (screen: Screen) => void }) {
  return (
    <div className="stack">
      <ScreenIntro
        copy="End device access without deleting your health record."
        eyebrow="SECURITY · SEQUENTIAL CONFIRMATION STATES"
        title="Protect a lost phone"
      />
      <Badge tone="amber">Before confirmation · Review</Badge>
      <Card>
        <p className="text-sm font-semibold text-[#031f50]">
          Log out all devices / freeze sessions
        </p>
        <p className="mt-3 text-xs leading-[1.45] text-[#53657c]">
          All current sessions will end, including this one. Every device must
          sign in and verify again before accessing your account.
        </p>
        <div className="mt-4">
          <Row
            detail="iPhone 14 · Chrome on Windows · Recovery device"
            icon={icons.smartphone}
            title="Devices in this request"
          />
        </div>
      </Card>
      <Guidance title="Authentication and connection required" tone="amber">
        Confirm your identity first. Sessions end only when the server confirms
        online. This is not a remote wipe of the lost phone.
      </Guidance>
      <PrimaryButton danger onClick={() => go("verifyRecovery")}>
        Authenticate & confirm logout of all devices
      </PrimaryButton>
      <SecondaryButton onClick={() => go("profile")}>
        Cancel · Keep sessions
      </SecondaryButton>
      <p className="text-xs leading-[1.45] text-[#53657c]">
        Server-held records and WelliID remain. Clinical consent is unchanged.
      </p>
      <div className="h-px bg-[#dae2ee]" />
      <Card className="border-[#edf2fa] bg-[#edf2fa]">
        <p className="text-[10px] font-semibold text-[#173b71]">
          AFTER CONFIRMATION · SEPARATE LATER STATE
        </p>
        <h3 className="mt-3 text-lg font-bold text-[#031f50]">
          ✓ Sessions ended
        </h3>
        <p className="mt-3 text-xs leading-[1.45] text-[#173b71]">
          Authenticated request confirmed online · 3 Oct 2026, 10:30 AM ·
          Africa/Lagos. All prior sessions ended.
        </p>
        <div className="mt-4">
          <PrimaryButton onClick={() => go("recoverAccount")}>
            Sign in again on a safe device
          </PrimaryButton>
        </div>
      </Card>
      <SecondaryButton>Contact recovery support</SecondaryButton>
    </div>
  )
}

function RecoverAccount({ go }: { go: (screen: Screen) => void }) {
  const [email, setEmail] = useState(false)
  return (
    <div className="stack">
      <ScreenIntro
        copy="Use a contact or passkey you previously verified."
        eyebrow="RECOVERY · BEFORE AUTHENTICATION"
        title="Recover your account"
      />
      <label>
        <span className="text-sm font-semibold">Phone number or email</span>
        <input
          className="mt-2 h-12 w-full rounded-xl border border-[#dae2ee] bg-white px-3 text-sm outline-none"
          defaultValue="+234 ••• ••• 0000"
        />
        <span className="mt-2 block text-xs text-[#53657c]">
          Masked demo contact · Enter your own verified contact in the app.
        </span>
      </label>
      <Card className="space-y-5">
        <Choice
          checked={!email}
          detail="Send a private verification code"
          onClick={() => setEmail(false)}
          title="Recover with verified phone"
        />
        <Choice
          checked={email}
          detail="Use an email you added to this account"
          onClick={() => setEmail(true)}
          title="Use verified email instead"
        />
        <p className="text-xs leading-[1.45] text-[#53657c]">
          If an account matches, instructions will be sent. This does not reveal
          whether an entered account exists.
        </p>
      </Card>
      <PrimaryButton onClick={() => go("verifyRecovery")}>
        Request recovery instructions
      </PrimaryButton>
      <SecondaryButton onClick={() => go("recovered")}>
        Recover with an existing passkey
      </SecondaryButton>
      <Guidance title="Your health identity is not lost">
        Your WelliID and server-held records remain even if your phone is lost.
        Recovery protects access; it does not delete medical records.
      </Guidance>
      <Card>
        <Row
          detail="Secure sessions after identity verification."
          icon={icons.smartphone}
          title="Lost your phone?"
          onClick={() => go("lostPhone")}
        />
      </Card>
    </div>
  )
}

function VerifyRecovery({ go }: { go: (screen: Screen) => void }) {
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const complete = code.every(Boolean)
  return (
    <div className="stack">
      <ScreenIntro
        copy="You are recovering access on another device."
        eyebrow="RECOVERY · PROTECTED VERIFICATION"
        title="Verify it’s you"
      />
      <div className="flex flex-col items-center rounded-[20px] bg-[#edf2fa] p-[22px] text-center">
        <span className="flex size-[60px] items-center justify-center rounded-full bg-[#031f50]">
          <Icon size={28} src={icons.shieldRecovery} />
        </span>
        <h3 className="mt-4 text-[22px] font-bold leading-[1.3]">
          Check your verified contact
        </h3>
        <p className="mt-3 text-sm text-[#53657c]">
          Demo destination · +234 ••• ••• 0000
        </p>
      </div>
      <div>
        <p className="text-sm font-semibold">6-digit recovery code</p>
        <div className="mt-3 grid grid-cols-6 gap-2">
          {code.map((digit, index) => (
            <input
              aria-label={`Recovery digit ${index + 1}`}
              className="h-14 min-w-0 rounded-xl border border-[#cbd7e8] bg-white text-center text-xl outline-none focus:border-[#031f50]"
              inputMode="numeric"
              key={index}
              maxLength={1}
              onChange={(event) => {
                const next = [...code]
                next[index] = event.target.value.replace(/\D/g, "")
                setCode(next)
              }}
              value={digit}
            />
          ))}
        </div>
        <p className="mt-3 text-sm leading-[1.45] text-[#53657c]">
          Code expires 10 minutes after sending. A new code invalidates the old
          one. Never reuse a sign-in or recovery code.
        </p>
      </div>
      <button
        className={`min-h-[50px] rounded-[14px] text-sm font-semibold ${
          complete ? "bg-[#031f50] text-white" : "bg-[#cbd7e8] text-[#53657c]"
        }`}
        disabled={!complete}
        onClick={() => go("recovered")}
      >
        Verify & continue
      </button>
      <SecondaryButton>Resend recovery code</SecondaryButton>
      <Guidance title="Recovery is protected">
        Verification is needed before changing security settings. No medical
        record is shared during recovery.
      </Guidance>
      <Card>
        <p className="text-sm font-semibold">Can’t access this contact?</p>
        <p className="mt-2 text-xs leading-[1.45] text-[#53657c]">
          Try an existing passkey or verified email. If neither works, contact
          recovery support for identity checks.
        </p>
      </Card>
    </div>
  )
}

function Recovered({ go }: { go: (screen: Screen) => void }) {
  return (
    <div className="stack">
      <ScreenIntro
        copy="Recovery verified. Your new passkey is configured."
        eyebrow="RECOVERY OUTCOME · AFTER VERIFIED RECOVERY"
        title="Your account is secured"
      />
      <div className="flex flex-col items-center rounded-[20px] bg-[#edf2fa] p-[22px] text-center">
        <span className="flex size-[60px] items-center justify-center rounded-full bg-[#031f50]">
          <Icon size={28} src={icons.key} />
        </span>
        <h3 className="mt-4 text-[22px] font-bold">Access recovered safely</h3>
        <p className="mt-3 text-sm text-[#53657c]">
          Adaeze Okafor · WR-4821-0936
        </p>
      </div>
      <Card>
        <Badge>New passkey configured</Badge>
        <div className="mt-4">
          <Row
            detail="Added after verified recovery · 3 Oct 2026"
            icon={icons.key}
            title="Passkey on this device"
          />
        </div>
        <p className="mt-3 text-xs text-[#53657c]">
          Use device screen lock or biometrics. Review your backup verified
          contact too.
        </p>
      </Card>
      <Guidance title="Your identity and records remain intact">
        Your WelliID and server-held records are unchanged. Recovery does not
        delete medical data or revoke clinical consent.
      </Guidance>
      <Card>
        <Row
          detail="Check iPhone 14 and Chrome on Windows."
          icon={icons.monitor}
          title="Review prior sessions"
          onClick={() => go("lostPhone")}
        />
      </Card>
      <PrimaryButton onClick={() => go("lostPhone")}>
        Review devices & sessions
      </PrimaryButton>
      <SecondaryButton onClick={() => go("lostPhone")}>
        Lost-phone protection
      </SecondaryButton>
      <SecondaryButton onClick={() => go("profile")}>
        Return to my account
      </SecondaryButton>
    </div>
  )
}

function Welcome({
  go,
  onCreateAccount,
}: {
  go: (screen: Screen) => void
  onCreateAccount: () => void
}) {
  return (
    <div className="stack">
      <ScreenIntro
        copy="A safe place to start your health record."
        eyebrow="NEW ACCOUNT · BEFORE RECORD LINKING"
        title="Welcome"
      />
      <div className="rounded-[20px] bg-[#edf2fa] p-6">
        <img alt="WelliRecord" className="size-[52px]" src={icons.logo} />
        <h3 className="mt-6 text-[31px] font-bold leading-[1.2]">
          Your health record.
          <br />
          Your identity.
          <br />
          Your control.
        </h3>
        <p className="mt-6 text-sm leading-[1.45]">
          Bring records together, understand their sources and choose who can
          see them.
        </p>
      </div>
      <Card className="space-y-5">
        <Row
          detail="Your WelliID stays with you, not your phone."
          icon={icons.fingerprint}
          title="One health identity"
        />
        <Row
          detail="Choose records, recipients and duration."
          icon={icons.shield}
          title="Permission, not assumptions"
        />
      </Card>
      <PrimaryButton onClick={onCreateAccount}>Create account</PrimaryButton>
      <SecondaryButton onClick={() => go("signIn")}>Sign in</SecondaryButton>
      <SecondaryButton onClick={() => go("preferences")}>
        Language & accessibility
      </SecondaryButton>
    </div>
  )
}

function SignIn({
  go,
  onSignIn,
  onCreateAccount,
}: {
  go: (screen: Screen) => void
  onSignIn: () => void
  onCreateAccount: () => void
}) {
  return (
    <div className="stack">
      <ScreenIntro
        copy="Use your passkey or verified contact to continue."
        eyebrow="RETURNING USER · SECURE ACCESS"
        title="Welcome back"
      />
      <Card>
        <p className="text-sm font-semibold">Adaeze Okafor</p>
        <p className="mt-2 text-xs text-[#53657c]">
          WR-4821-0936 · Last active today, 08:42
        </p>
      </Card>
      <PrimaryButton onClick={onSignIn}>
        Continue with passkey
      </PrimaryButton>
      <SecondaryButton onClick={onSignIn}>
        Send a code to my verified phone
      </SecondaryButton>
      <Guidance title="Your records stay protected">
        Signing in restores access to your existing WelliID and records. It
        does not create a new health record or change consent.
      </Guidance>
      <Card>
        <Row
          detail="Use a verified contact or complete identity checks"
          icon={icons.key}
          title="Can’t sign in?"
          onClick={() => go("recoverAccount")}
        />
      </Card>
      <div className="h-px bg-[#dae2ee]" />
      <p className="text-center text-xs text-[#53657c]">
        New to WelliRecord?
      </p>
      <SecondaryButton onClick={onCreateAccount}>
        Create an account
      </SecondaryButton>
    </div>
  )
}

function CreateAccount({ go }: { go: (screen: Screen) => void }) {
  const [email, setEmail] = useState(false)
  const [terms, setTerms] = useState(true)
  return (
    <div className="stack">
      <ScreenIntro
        copy="Use a phone number or email you can access."
        eyebrow="NEW ACCOUNT · STEP 1 OF 4"
        title="Create your account"
      />
      <label>
        <span className="text-sm font-semibold">Full name</span>
        <input
          className="mt-2 h-12 w-full rounded-xl border border-[#dae2ee] px-3 text-sm"
          defaultValue="Adaeze Okafor"
        />
        <span className="mt-2 block text-xs text-[#53657c]">
          Use the name you use with your healthcare provider.
        </span>
      </label>
      <Card className="space-y-5">
        <Choice
          checked={!email}
          detail="Selected contact method"
          onClick={() => setEmail(false)}
          title="Phone number"
        />
        {!email && (
          <label className="block pl-[34px]">
            <span className="text-sm font-semibold">Nigeria (+234) · Phone</span>
            <input
              className="mt-2 h-12 w-full rounded-xl border border-[#dae2ee] px-3 text-sm"
              defaultValue="0800 000 0000"
            />
            <span className="mt-2 block text-xs text-[#53657c]">
              Fictional demo number, not a real credential.
            </span>
          </label>
        )}
        <Choice
          checked={email}
          onClick={() => setEmail(true)}
          title="Use email instead"
        />
      </Card>
      <Choice
        checked={terms}
        detail="Required for account setup · Read privacy and terms →"
        onClick={() => setTerms(!terms)}
        title="I acknowledge the Privacy Notice and agree to the Terms"
      />
      <Guidance title="Optional choices · Off">
        Research participation is off. Record sharing is not granted here. Any
        future request needs a separate scope, purpose and duration choice.
      </Guidance>
      <PrimaryButton
        onClick={terms ? () => go("verifyPhone") : undefined}
      >
        Continue to verify contact
      </PrimaryButton>
    </div>
  )
}

function Preferences({ go }: { go: (screen: Screen) => void }) {
  const [language, setLanguage] = useState("English")
  const [large, setLarge] = useState(true)
  const [contrast, setContrast] = useState(false)
  return (
    <div className="stack">
      <ScreenIntro
        copy="Language and reading preferences can be changed later."
        eyebrow="PREFERENCES · AVAILABLE BEFORE SIGN-IN"
        title="Make it easier to use"
      />
      <div>
        <h3 className="text-lg font-bold">Choose a language</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {["English", "Pidgin", "Hausa", "Yoruba", "Igbo"].map((item) => (
            <button
              className={`rounded-[14px] px-4 py-3 text-sm font-semibold ${
                language === item
                  ? "bg-[#031f50] text-white"
                  : "bg-[#edf2fa] text-[#173b71]"
              }`}
              key={item}
              onClick={() => setLanguage(item)}
            >
              {language === item ? "✓ " : ""}
              {item}
            </button>
          ))}
        </div>
      </div>
      <Card>
        <Choice
          checked={large}
          onClick={() => setLarge(!large)}
          title={`Larger text · ${large ? "On" : "Off"}`}
        />
        <div className="mt-5 rounded-[14px] bg-[#edf2fa] p-4">
          <p className="text-xs font-semibold text-[#53657c]">
            LARGE-TEXT SAMPLE
          </p>
          <p className="mt-3 text-2xl font-bold leading-[1.25]">
            Choose who can see your records.
          </p>
          <p className="mt-3 text-lg">You can review and change access.</p>
        </div>
        <p className="mt-4 text-xs text-[#53657c]">
          Text wraps inside cards. Buttons and labels stay readable.
        </p>
      </Card>
      <Card className="space-y-5">
        <Choice
          checked={contrast}
          detail="Stronger borders and text contrast"
          onClick={() => setContrast(!contrast)}
          title={`High contrast · ${contrast ? "On" : "Off"}`}
        />
        <Choice
          checked
          detail="Meaningful labels and logical reading order"
          title="Screen-reader support · On"
        />
        <Choice
          checked
          detail="Prefer static changes over movement"
          title="Reduce motion · On"
        />
      </Card>
      <Guidance title="Clinical originals stay unchanged">
        Navigation and explanations may be translated. Original reports retain
        their source language and content.
      </Guidance>
      <PrimaryButton onClick={() => go("emptyVault")}>
        Save preferences
      </PrimaryButton>
    </div>
  )
}

function EmptyVault({ go }: { go: (screen: Screen) => void }) {
  return (
    <div className="stack">
      <ScreenIntro
        copy="Adaeze Okafor · WR-4821-0936"
        eyebrow="NEW ACCOUNT · NO RECORDS LINKED"
        title="Your Health Vault"
      />
      <div className="flex flex-col items-center rounded-[20px] bg-[#edf2fa] p-[22px] text-center">
        <span className="flex size-[60px] items-center justify-center rounded-full bg-[#031f50]">
          <Icon size={28} src={icons.vault} />
        </span>
        <h3 className="mt-4 text-[22px] font-bold">
          Your first record starts here
        </h3>
        <p className="mt-3 text-sm leading-[1.45] text-[#53657c]">
          No health records yet. No diagnoses or record totals are assumed.
        </p>
      </div>
      <PrimaryButton onClick={() => go("records")}>Add a document</PrimaryButton>
      <SecondaryButton>Connect a participating provider</SecondaryButton>
      <Card>
        <Row
          detail="Ask your provider for a copy of your earlier reports."
          icon={icons.files}
          title="Request prior records"
        />
        <p className="mt-4 text-sm leading-[1.45]">
          A PDF or photo is enough to begin. Keep the original and check that
          the name, date and source are readable.
        </p>
      </Card>
      <Guidance title="Adding a record does not share it">
        You choose recipients, scope and duration separately in Share.
      </Guidance>
      <Guidance title="Know where a record came from">
        Look for Verified provider, Patient Added or Imported labels.
      </Guidance>
    </div>
  )
}

function BookingTime({ go }: { go: (screen: Screen) => void }) {
  const [date, setDate] = useState("05")
  const [time, setTime] = useState("10:30 AM")
  return (
    <div className="stack">
      <ScreenIntro
        copy="A 30-minute consultation, in person."
        eyebrow="BOOKING · SELECT A TIME"
        title="Choose your visit time"
      />
      <Card>
        <Row
          detail="Internal medicine · Lagoon Hospital, Ikeja"
          icon={icons.stethoscope}
          title="Dr Amaka Bello"
        />
        <div className="mt-3">
          <Badge>Verified provider</Badge>
        </div>
        <p className="mt-4 text-sm text-[#53657c]">
          3 Obafemi Awolowo Way, Ikeja, Lagos
        </p>
        <p className="mt-3 text-xs text-[#53657c]">
          Reliance accepted · Service eligibility and authorization checked at
          review.
        </p>
      </Card>
      <div>
        <h3 className="text-lg font-bold">October 2026</h3>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            ["Mon", "05"],
            ["Tue", "06"],
            ["Wed", "07"],
            ["Thu", "08"],
          ].map(([day, number]) => (
            <button
              className={`rounded-[14px] py-3 ${
                date === number
                  ? "bg-[#031f50] text-white"
                  : "bg-[#edf2fa] text-[#53657c]"
              }`}
              key={number}
              onClick={() => setDate(number)}
            >
              <span className="block text-xs">{day}</span>
              <span className="mt-1 block text-2xl font-bold">{number}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">Mon, {date} Oct · Africa/Lagos</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["9:30 AM", "10:30 AM", "11:30 AM"].map((item) => (
            <button
              className={`h-12 rounded-xl border text-sm font-semibold ${
                time === item
                  ? "border-[#031f50] bg-[#031f50] text-white"
                  : "border-[#dae2ee] bg-white"
              }`}
              key={item}
              onClick={() => setTime(item)}
            >
              {time === item ? "✓ " : ""}
              {item}
            </button>
          ))}
        </div>
      </div>
      <Guidance title={`Selected · ${date} Oct at ${time}`}>
        Times shown are a sample of provider availability. The slot is not
        reserved until booking is confirmed.
      </Guidance>
      <PrimaryButton onClick={() => go("bookingReview")}>
        Review booking
      </PrimaryButton>
      <SecondaryButton>See other dates</SecondaryButton>
    </div>
  )
}

function BookingReview({
  go,
  onConfirm,
}: {
  go: (screen: Screen) => void
  onConfirm: () => void
}) {
  return (
    <div className="stack">
      <ScreenIntro
        copy="Check your visit and costs before confirming."
        eyebrow="BOOKING · REVIEW"
        title="Review your booking"
      />
      <Card>
        <Row
          detail="Internal medicine · Verified provider"
          icon={icons.stethoscope}
          title="Dr Amaka Bello"
        />
        <p className="mt-4 text-sm font-semibold">
          Mon, 5 Oct 2026 · 10:30 AM · 30 min
        </p>
        <p className="mt-4 text-sm leading-[1.45] text-[#53657c]">
          Lagoon Hospital, Ikeja
          <br />
          3 Obafemi Awolowo Way
          <br />
          Reason: hypertension follow-up
        </p>
        <p className="mt-4 text-xs text-[#53657c]">
          Time zone: Africa/Lagos
        </p>
      </Card>
      <SectionTitle>Coverage & registration</SectionTitle>
      <Card>
        <Badge>Consultation authorized</Badge>
        <p className="mt-4 text-sm font-semibold">
          Reliance HMO · RL-AU-51073
        </p>
        <p className="mt-3 text-xs leading-[1.45] text-[#53657c]">
          Member RL-209184 · Active through 31 Dec 2026. Tests may need separate
          authorization.
        </p>
        <p className="mt-4 text-sm font-semibold">₦5,000 registration fee</p>
        <p className="mt-2 text-xs text-[#53657c]">
          Not covered by HMO · Separate bill LG-B051026-073.
        </p>
      </Card>
      <Guidance title="Booking information only">
        Send your name, WelliID, verified contact, selected clinician/time,
        reason and HMO authorization. No lab reports are included.
      </Guidance>
      <Guidance title="Sharing is a separate choice">
        Confirming this booking does not grant clinical record access.
      </Guidance>
      <PrimaryButton onClick={onConfirm}>Confirm booking</PrimaryButton>
      <SecondaryButton onClick={() => go("bookingTime")}>
        Change visit details
      </SecondaryButton>
    </div>
  )
}

function Offline({ go }: { go: (screen: Screen) => void }) {
  return (
    <div className="stack">
      <ScreenIntro
        copy="Some saved information is available on this device."
        eyebrow="RELIABILITY · CACHED VIEW · 3 OCT 2026"
        title="You’re offline"
      />
      <Guidance title="Last synced 3 Oct 2026, 08:42" tone="amber">
        Africa/Lagos · Saved information may be out of date. This view cannot
        confirm recent clinical changes or current access permissions.
      </Guidance>
      <Card>
        <Badge>Cached emergency basics</Badge>
        <p className="mt-4 text-sm font-semibold">
          Adaeze Okafor · WR-4821-0936
        </p>
        <p className="mt-3 text-sm leading-[1.5] text-[#173b71]">
          O+ blood · AA genotype
          <br />
          Penicillin allergy · Rash
          <br />
          Provider-confirmed source at last sync
        </p>
        <p className="mt-3 text-sm text-[#53657c]">
          Emergency contact: Chidi Okafor · Husband
          <br />
          +234 803 555 0142
        </p>
        <p className="mt-3 text-xs text-[#53657c]">
          Confirm current details with the patient or clinician; do not assume
          this is a live record.
        </p>
      </Card>
      <SectionTitle>Waiting for connection</SectionTitle>
      <Card>
        <Row
          detail="Full blood count.pdf · 284 KB"
          icon={icons.cloudUpload}
          title="1 queued upload"
        />
        <div className="mt-4">
          <Badge tone="amber">Consented queue · Not uploaded</Badge>
        </div>
        <p className="mt-3 text-xs leading-[1.45] text-[#53657c]">
          You chose to queue this file. It awaits connection; it is not added to
          your record.
        </p>
      </Card>
      <Guidance title="Low-data mode · On">
        Sync text first. Download PDFs on Wi-Fi. No sensitive health details
        sent by SMS.
      </Guidance>
      <Guidance title="Consent changes need you online">
        Granting or revoking access requires online confirmation.
      </Guidance>
      <PrimaryButton onClick={() => go("records")}>Check connection</PrimaryButton>
      <SecondaryButton onClick={() => go("profile")}>
        View saved emergency basics
      </SecondaryButton>
    </div>
  )
}

function UploadFailed({ go }: { go: (screen: Screen) => void }) {
  return (
    <div className="stack">
      <ScreenIntro
        copy="A network problem interrupted the transfer."
        eyebrow="RELIABILITY · LOCAL DRAFT PRESERVED"
        title="Your upload didn’t finish"
      />
      <div className="flex flex-col items-center rounded-[20px] bg-[#faedea] p-[22px] text-center">
        <span className="flex size-[60px] items-center justify-center rounded-full bg-[#af4540]">
          <Icon size={28} src={icons.cloudOff} />
        </span>
        <h3 className="mt-4 text-[22px] font-bold">You can try again</h3>
        <p className="mt-3 text-sm text-[#53657c]">
          Your selected PDF is still saved as a local pending draft.
        </p>
      </div>
      <Card>
        <Row
          detail="284 KB · 2 pages · Selected on this device"
          icon={icons.fileText}
          title="Full blood count.pdf"
        />
        <div className="mt-4">
          <Badge tone="red">Upload failed · Network error</Badge>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf2fa]">
          <div className="h-full w-[42%] bg-[#af4540]" />
        </div>
        <p className="mt-3 text-xs text-[#53657c]">
          Transfer interrupted at 42%. Server receipt is not confirmed.
        </p>
        <p className="mt-4 text-sm font-semibold">
          Not added to your clinical record
        </p>
      </Card>
      <Guidance title="Nothing has been queued automatically" tone="amber">
        Retry sends this selected file now. Save for later keeps the draft on
        this device.
      </Guidance>
      <PrimaryButton onClick={() => go("records")}>Retry upload</PrimaryButton>
      <SecondaryButton onClick={() => go("offline")}>
        Save draft for later
      </SecondaryButton>
      <SecondaryButton onClick={() => go("records")}>
        Remove local draft
      </SecondaryButton>
    </div>
  )
}

function LabsLoading({ go }: { go: (screen: Screen) => void }) {
  return (
    <div className="stack">
      <ScreenIntro
        copy="Adaeze Okafor · WR-4821-0936"
        eyebrow="RELIABILITY · LOADING, NOT EMPTY"
        title="Laboratory results"
      />
      <div className="flex items-center gap-4 rounded-[20px] bg-[#edf2fa] p-[22px]">
        <Icon size={32} src={icons.loader} />
        <div>
          <p className="text-sm font-semibold">Loading your reports…</p>
          <p className="mt-1 text-xs text-[#53657c]">
            Checking the latest available records.
          </p>
        </div>
      </div>
      <p className="text-xs text-[#53657c]">
        Report count will appear after loading.
      </p>
      {[1, 2, 3].map((item) => (
        <div
          className="rounded-[20px] border border-[#dae2ee] bg-white p-4"
          key={item}
        >
          <div className="h-4 rounded-md bg-[#dfe7f3]" />
          <div className="mt-3 h-3 rounded-md bg-[#edf2fa]" />
          <div className="mt-4 h-10 rounded-lg bg-[#e7edf6]" />
          <div className="mt-3 h-4 w-3/5 rounded-md bg-[#edf2fa]" />
        </div>
      ))}
      <Guidance title="Your cached records are still safe">
        Loading does not delete your saved records. If the connection fails, you
        can return to the cached view.
      </Guidance>
      <SecondaryButton onClick={() => go("reports")}>
        Cancel loading & go back
      </SecondaryButton>
    </div>
  )
}

function VerifyPhone({ go }: { go: (screen: Screen) => void }) {
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const complete = code.every(Boolean)
  return (
    <div className="stack">
      <ScreenIntro
        copy="Enter the 6-digit code sent to your demo contact."
        eyebrow="NEW ACCOUNT · STEP 2 OF 4"
        title="Verify your phone"
      />
      <div className="flex flex-col items-center rounded-[20px] bg-[#edf2fa] p-[22px] text-center">
        <span className="flex size-[60px] items-center justify-center rounded-full bg-[#031f50]">
          <Icon size={28} src={icons.message} />
        </span>
        <h3 className="mt-4 text-[22px] font-bold">Check your messages</h3>
        <p className="mt-3 text-sm text-[#53657c]">
          Demo destination · +234 ••• ••• 0000
        </p>
      </div>
      <div>
        <p className="text-sm font-semibold">6-digit verification code</p>
        <div className="mt-3 grid grid-cols-6 gap-2">
          {code.map((digit, index) => (
            <input
              aria-label={`Verification digit ${index + 1}`}
              className="h-14 min-w-0 rounded-xl border border-[#cbd7e8] text-center text-xl outline-none focus:border-[#031f50]"
              inputMode="numeric"
              key={index}
              maxLength={1}
              onChange={(event) => {
                const next = [...code]
                next[index] = event.target.value.replace(/\D/g, "")
                setCode(next)
              }}
              value={digit}
            />
          ))}
        </div>
        <p className="mt-3 text-sm leading-[1.45] text-[#53657c]">
          Code expires 10 minutes after it is sent. Resending replaces the
          previous code. No real code is shown in this sample.
        </p>
      </div>
      <button
        className={`min-h-[50px] rounded-[14px] text-sm font-semibold ${
          complete ? "bg-[#031f50] text-white" : "bg-[#cbd7e8] text-[#53657c]"
        }`}
        disabled={!complete}
        onClick={() => go("onboardingId")}
      >
        Verify contact
      </button>
      <SecondaryButton>Resend code</SecondaryButton>
      <SecondaryButton onClick={() => go("createAccount")}>
        Change phone or use email
      </SecondaryButton>
      <Guidance title="Keep your code private">
        WelliRecord support will never ask you to read a verification code to
        them.
      </Guidance>
    </div>
  )
}

function OnboardingId({ go }: { go: (screen: Screen) => void }) {
  const [informed, setInformed] = useState(true)
  return (
    <div className="stack">
      <ScreenIntro
        copy="New-account sample · No clinical records linked yet."
        eyebrow="NEW ACCOUNT · STEP 3 OF 4"
        title="Set up your WelliID"
      />
      <Card className="border-[#031f50] bg-[#031f50] text-white">
        <p className="text-[10px] text-[#e0e9f8]">
          YOUR NEW HEALTH IDENTIFIER
        </p>
        <p className="mt-4 text-[22px] font-semibold">WR-4821-0936</p>
        <p className="mt-3 text-[11px] text-[#e0e9f8]">
          Allocated in this sample flow · Adaeze Okafor
        </p>
      </Card>
      <label>
        <span className="text-sm font-semibold">Date of birth</span>
        <input
          className="mt-2 h-12 w-full rounded-xl border border-[#dae2ee] px-3 text-sm"
          defaultValue="14 Jun 1992"
        />
        <span className="mt-2 block text-xs text-[#53657c]">
          Female · Lagos · Verified account contact: +234 ••• ••• 0000
        </span>
      </label>
      <div>
        <SectionTitle>Optional health basics</SectionTitle>
        <Card className="mt-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold">
              Blood group
              <input
                className="mt-2 h-12 w-full rounded-lg border border-[#dae2ee] px-3 font-normal"
                defaultValue="O+"
              />
            </label>
            <label className="text-xs font-semibold">
              Genotype
              <input
                className="mt-2 h-12 w-full rounded-lg border border-[#dae2ee] px-3 font-normal"
                defaultValue="AA"
              />
            </label>
          </div>
          <div className="mt-3">
            <Badge>Added by you · Not clinically verified</Badge>
          </div>
          <p className="mt-3 text-xs text-[#53657c]">
            These entries are not provider-confirmed history.
          </p>
        </Card>
      </div>
      <div>
        <SectionTitle>Emergency contact · Optional</SectionTitle>
        <Card className="mt-3">
          <p className="text-sm font-semibold">Chidi Okafor · Husband</p>
          <p className="mt-3 text-xs leading-[1.45] text-[#53657c]">
            +234 803 555 0142
            <br />
            Separate WelliID WR-7204-1683
          </p>
          <p className="mt-3 text-xs leading-[1.45] text-[#53657c]">
            Tell Chidi that you are adding his details. This does not give him
            access to your record.
          </p>
          <div className="mt-4">
            <Choice
              checked={informed}
              onClick={() => setInformed(!informed)}
              title="I have informed this contact"
            />
          </div>
        </Card>
      </div>
      <Guidance title="Emergency essentials preview">
        Name & WelliID and emergency contact are included. Blood group and
        genotype are not included yet.
      </Guidance>
      <Guidance title="WelliID is not a national ID">
        NIN linkage is optional. A health identifier does not replace your
        national ID.
      </Guidance>
      <PrimaryButton onClick={() => go("onboardingRecord")}>
        Save basics & continue
      </PrimaryButton>
    </div>
  )
}

function OnboardingRecord({
  go,
  onComplete,
}: {
  go: (screen: Screen) => void
  onComplete: (next: Screen) => void
}) {
  return (
    <div className="stack">
      <ScreenIntro
        copy="Your WelliID is ready. Your new Vault is empty."
        eyebrow="NEW ACCOUNT · STEP 4 OF 4"
        title="Start with one record"
      />
      <div className="flex flex-col items-center rounded-[20px] bg-[#edf2fa] p-[22px] text-center">
        <span className="flex size-[60px] items-center justify-center rounded-full bg-[#031f50]">
          <Icon size={28} src={icons.folderPlus} />
        </span>
        <h3 className="mt-4 text-[22px] font-bold">
          No records connected yet
        </h3>
        <p className="mt-3 text-sm leading-[1.45] text-[#53657c]">
          Add one when you are ready. You can also skip this step.
        </p>
      </div>
      <Card className="space-y-5">
        <Row
          detail="Review a connection request and its purpose."
          icon={icons.hospital}
          title="Connect a participating provider"
        />
        <Row
          detail="Choose a PDF or photo from your device."
          icon={icons.upload}
          title="Upload a document"
        />
        <p className="text-xs leading-[1.45] text-[#53657c]">
          Connecting does not automatically give a provider access to your
          other records.
        </p>
      </Card>
      <Guidance title="You will always see the source">
        Provider-issued records show Verified provider. Your uploads show
        Patient Added. Imported records are not automatically verified.
      </Guidance>
      <Guidance title="AI extraction needs your review">
        Check extracted values against the original before confirming.
      </Guidance>
      <PrimaryButton onClick={() => onComplete("records")}>
        Connect a provider
      </PrimaryButton>
      <SecondaryButton onClick={() => go("uploadFailed")}>
        Upload a document
      </SecondaryButton>
      <SecondaryButton onClick={() => onComplete("home")}>
        Skip for now
      </SecondaryButton>
    </div>
  )
}

function BookingConfirmed({ go }: { go: (screen: Screen) => void }) {
  return (
    <div className="stack">
      <ScreenIntro
        copy="Keep your appointment details close."
        eyebrow="BOOKING OUTCOME · BEFORE THE VISIT"
        title="Your visit is booked"
      />
      <div className="flex flex-col items-center rounded-[20px] bg-[#edf2fa] p-[22px] text-center">
        <span className="flex size-[60px] items-center justify-center rounded-full bg-[#031f50]">
          <Icon size={28} src={icons.calendarCheck} />
        </span>
        <h3 className="mt-4 text-[22px] font-bold">Booking confirmed</h3>
        <p className="mt-3 text-sm text-[#53657c]">
          Appointment LG-051026-073
        </p>
      </div>
      <Card className="border-[#031f50] bg-[#031f50] text-white">
        <p className="text-xl font-bold">Mon, 5 Oct 2026 · 10:30 AM</p>
        <p className="mt-4 text-sm text-[#e0e9f8]">30 min · Africa/Lagos</p>
        <p className="mt-4 text-sm font-semibold">
          Dr Amaka Bello · Internal medicine
        </p>
        <p className="mt-4 text-sm text-[#e0e9f8]">
          Lagoon Hospital, Ikeja
          <br />3 Obafemi Awolowo Way
        </p>
      </Card>
      <Guidance title="Record access ends before this visit" tone="amber">
        C-1031 ends 4 Oct at 9:41 AM. Booking has not extended access. Review
        sharing separately if you want access during the visit.
      </Guidance>
      <PrimaryButton onClick={() => go("visitPrep")}>
        Prepare for your visit
      </PrimaryButton>
      <Card>
        <Row
          detail="Lagoon Hospital, Ikeja"
          icon={icons.mapPin}
          title="Get directions"
        />
      </Card>
      <Card>
        <Row
          detail="1 day before · No health details on lock screen"
          icon={icons.bell}
          title="In-app reminder · On"
        />
      </Card>
      <SecondaryButton onClick={() => go("bookingTime")}>
        Reschedule
      </SecondaryButton>
    </div>
  )
}

function CheckIn({
  onCheckIn,
}: {
  onCheckIn: () => void
}) {
  const [camera, setCamera] = useState(false)
  return (
    <div className="stack">
      <ScreenIntro
        copy="At the participating hospital? Match your visit first."
        eyebrow="ARRIVAL · 5 OCT 2026 · BEFORE CHECK-IN"
        title="Check in at Lagoon"
      />
      <Card>
        <Badge>Matched appointment</Badge>
        <div className="mt-4">
          <Row
            detail="WR-4821-0936 · LG-051026-073"
            icon={icons.calendarCheck}
            title="Adaeze Okafor"
          />
        </div>
        <p className="mt-4 text-xs leading-[1.45] text-[#53657c]">
          Dr Amaka Bello · Today, 10:30 AM. Confirm facility and appointment
          with reception.
        </p>
      </Card>
      <div className="flex min-h-[176px] flex-col items-center justify-center rounded-[20px] border border-[#dae2ee] bg-[#edf2fa] text-center">
        <Icon size={54} src={icons.scanCheckin} />
        <p className="mt-5 text-sm font-semibold">
          {camera ? "Camera ready to scan" : "Camera is not enabled yet"}
        </p>
      </div>
      <p className="text-sm leading-[1.45] text-[#53657c]">
        Allow camera access to scan the facility check-in QR. Used only for
        scanning; you can enter your WelliID instead.
      </p>
      <PrimaryButton
        onClick={() => {
          if (camera) onCheckIn()
          else setCamera(true)
        }}
      >
        {camera ? "Scan QR & check in" : "Allow camera & scan facility QR"}
      </PrimaryButton>
      <label>
        <span className="text-sm font-semibold">Or enter your WelliID</span>
        <input
          className="mt-2 h-12 w-full rounded-xl border border-[#dae2ee] px-3 text-sm"
          defaultValue="WR-4821-0936"
        />
      </label>
      <SecondaryButton onClick={onCheckIn}>
        Check in with WelliID
      </SecondaryButton>
      <Guidance title="Check-in is not record sharing">
        The QR opens a secure, minimum-necessary endpoint. Your record-sharing
        scope stays separate.
      </Guidance>
    </div>
  )
}

function CheckedIn({ go }: { go: (screen: Screen) => void }) {
  return (
    <div className="stack">
      <ScreenIntro
        copy="Lagoon Hospital, Ikeja · Keep your phone with you."
        eyebrow="ARRIVAL OUTCOME · 5 OCT 2026, 9:20 AM"
        title="You’re checked in"
      />
      <div className="flex flex-col items-center rounded-[20px] bg-[#edf2fa] p-[22px] text-center">
        <span className="flex size-[60px] items-center justify-center rounded-full bg-[#031f50]">
          <Icon size={28} src={icons.clipboard} />
        </span>
        <h3 className="mt-4 text-[22px] font-bold">
          Registration confirmed
        </h3>
        <p className="mt-3 text-sm text-[#53657c]">
          Checked in 5 Oct 2026 at 9:20 AM · Africa/Lagos
        </p>
      </div>
      <Card>
        <p className="text-sm font-semibold">
          Adaeze Okafor · WR-4821-0936
        </p>
        <p className="mt-4 text-sm leading-[1.45] text-[#53657c]">
          Visit LG-051026-073
          <br />
          Dr Amaka Bello · 10:30 AM appointment
        </p>
        <div className="mt-4">
          <Badge>Facility-confirmed check-in</Badge>
        </div>
      </Card>
      <SectionTitle>Next in your care</SectionTitle>
      <Card className="space-y-5">
        <Row
          detail="WelliID matched · 9:20 AM"
          icon={icons.success}
          title="Registration · Complete"
        />
        <Row
          detail="Not started yet. Reception will guide you."
          icon={icons.history}
          title="Triage · Next"
        />
      </Card>
      <Guidance title="Please stay near the waiting area">
        Visit timing may change. Ask reception if you need help or if your
        symptoms worsen.
      </Guidance>
      <PrimaryButton onClick={() => go("careJourney")}>
        View care journey
      </PrimaryButton>
      <SecondaryButton onClick={() => go("bookingConfirmed")}>
        View appointment details
      </SecondaryButton>
    </div>
  )
}

function RecordChat({ go }: { go: (screen: Screen) => void }) {
  const [question, setQuestion] = useState("")
  return (
    <div className="stack">
      <Guidance title="Your permission, your sources">
        Record understanding is enabled for this chat: your last visit,
        prescription and blood count only. No provider receives this
        conversation.
      </Guidance>
      <div className="ml-auto max-w-[88%] rounded-[14px] bg-[#031f50] p-4 text-sm leading-[1.45] text-white">
        <p className="mb-2 text-[10px] text-[#b9c9e3]">YOU · 9:38 AM</p>
        What happened at my last visit, and what should I ask next?
      </div>
      <Card>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon size={20} src={icons.sparklesRecord} />
          From your records
        </div>
        <p className="mt-4 text-[13px] leading-[1.55] text-[#173b71]">
          On 28 September, Dr Amaka Bello reviewed your recorded hypertension,
          continued amlodipine 5 mg daily and requested a full blood count. A
          ferrous sulfate prescription was also issued. [1, 2]
        </p>
        <p className="mt-4 text-[13px] leading-[1.55] text-[#173b71]">
          Your 29 September report lists haemoglobin at 10.2 g/dL, below
          SYNLAB’s reference range of 12.0–15.5 g/dL. This result alone does not
          tell us the cause. [3]
        </p>
        <p className="mt-4 text-sm font-semibold">
          For your 5 October follow-up
        </p>
        <ul className="mt-3 space-y-2 text-[13px] leading-[1.45] text-[#173b71]">
          <li>• What does this blood result mean in my case?</li>
          <li>• Do I need any further tests?</li>
          <li>
            • How long should I take my prescribed medicines, and when should
            we review them?
          </li>
        </ul>
        <p className="mt-4 text-[11px] leading-[1.45] text-[#718096]">
          No new diagnosis has been added. This is record understanding and
          education, not medical advice.
        </p>
      </Card>
      <SectionTitle action="Manage access">Sources used</SectionTitle>
      <Card className="space-y-5">
        <Row
          detail="Dr Bello · Lagoon Hospital · Verified"
          icon={icons.recordStethoscope}
          title="[1] Consultation · 28 Sep"
        />
        <Row
          detail="Dr Bello · Lagoon Hospital · Verified"
          icon={icons.recordPrescription}
          title="[2] Prescription · 28 Sep"
        />
        <Row
          detail="SYNLAB Ikeja · Verified laboratory report"
          icon={icons.recordLab}
          title="[3] Full blood count · 29 Sep"
        />
      </Card>
      <SecondaryButton onClick={() => go("result")}>
        What does haemoglobin measure? →
      </SecondaryButton>
      <form
        className="flex h-14 items-center rounded-[14px] border border-[#dae2ee] bg-white px-4"
        onSubmit={(event) => {
          event.preventDefault()
          setQuestion("")
        }}
      >
        <input
          className="flex-1 bg-transparent text-sm outline-none"
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about your record…"
          value={question}
        />
        <button aria-label="Send question" className="text-xl" type="submit">
          ↑
        </button>
      </form>
    </div>
  )
}

function CareDiscovery({ go }: { go: (screen: Screen) => void }) {
  return (
    <div className="stack">
      <button className="flex items-center gap-2 text-xs font-semibold text-[#24518c]">
        <Icon size={16} src={icons.careMapPin} />
        Ikeja, Lagos · Set manually
      </button>
      <label className="flex h-[52px] items-center gap-3 rounded-[14px] border border-[#dae2ee] bg-white px-4">
        <Icon src={icons.search} />
        <input
          className="w-full bg-transparent text-sm outline-none"
          placeholder="What care do you need?"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {["All providers", "Reliance HMO", "Open now", "Specialty"].map(
          (filter) => (
            <button
              className="rounded-full border border-[#dae2ee] bg-white px-3 py-2 text-[11px] font-semibold"
              key={filter}
            >
              {filter}
            </button>
          ),
        )}
      </div>
      <SectionTitle>Your connected hospital</SectionTitle>
      <Card className="overflow-hidden p-0">
        <img
          alt="Lagoon Hospital exterior"
          className="h-44 w-full object-cover"
          src={icons.hospitalPhoto}
        />
        <div className="p-[18px]">
          <h3 className="text-lg font-bold">Lagoon Hospital, Ikeja</h3>
          <p className="mt-3 text-xs leading-[1.45] text-[#53657c]">
            Hospital · 2.1 km · Open 24 hours
            <br />3 Obafemi Awolowo Way, Ikeja
          </p>
          <div className="mt-3 flex gap-2">
            <Badge>Participating</Badge>
            <Badge>Reliance accepted</Badge>
          </div>
          <div className="mt-4">
            <PrimaryButton onClick={() => go("bookingTime")}>
              Book an appointment
            </PrimaryButton>
          </div>
        </div>
      </Card>
      <SectionTitle action="Map view">More ways to get care</SectionTitle>
      <Card>
        <Row
          detail="Laboratory · 1.4 km · Today, 8 AM–4 PM"
          icon={icons.lab}
          title="SYNLAB Ikeja"
          onClick={() => go("reports")}
        />
        <p className="mt-4 text-xs text-[#53657c]">
          Participating provider · Reliance: eligible tests
        </p>
      </Card>
      <Card>
        <Row
          detail="Pharmacy · 0.8 km · Open until 9 PM"
          icon={icons.pill}
          title="HealthPlus, Ikeja"
        />
        <p className="mt-4 text-xs text-[#53657c]">
          Participating provider · Reliance: approved prescriptions
        </p>
      </Card>
      <Card>
        <Row
          detail="Internal medicine · Lagoon Hospital · Mon, 5 Oct"
          icon={icons.stethoscope}
          title="Dr Amaka Bello"
          onClick={() => go("bookingTime")}
        />
      </Card>
      <p className="text-xs leading-[1.45] text-[#53657c]">
        Coverage may require HMO authorization. Confirm eligibility and opening
        times with the provider.
      </p>
    </div>
  )
}

function VisitPrep({ go }: { go: (screen: Screen) => void }) {
  const [ready, setReady] = useState([true, true, false, false])
  const items = [
    ["Confirm your allergy", "Penicillin · Rash · Provider confirmed"],
    ["Review current medicines", "Amlodipine 5 mg · Ferrous sulfate 200 mg"],
    [
      "Complete pre-visit questionnaire",
      "How you feel today · Saved as Patient Added",
    ],
    ["Choose previous reports to share", "SYNLAB full blood count · 29 Sep"],
  ]
  return (
    <div className="stack">
      <Card className="border-[#031f50] bg-[#031f50] text-white">
        <div className="grid grid-cols-[56px_1fr] gap-4">
          <div className="rounded-xl bg-white p-2 text-center text-[#031f50]">
            <span className="text-[10px]">OCT</span>
            <span className="mt-1 block text-2xl font-bold">05</span>
          </div>
          <div>
            <p className="text-sm font-semibold">Monday · 10:30 AM</p>
            <p className="mt-1 text-xs text-[#e0e9f8]">
              Hypertension follow-up · 30 min
            </p>
            <p className="mt-1 text-[11px] text-[#b9c9e3]">
              Appointment LG-051026-073
            </p>
          </div>
        </div>
        <p className="mt-5 text-sm font-semibold">Dr Amaka Bello</p>
        <p className="mt-3 text-xs leading-[1.45] text-[#e0e9f8]">
          Lagoon Hospital, Ikeja · Internal medicine
          <br />3 Obafemi Awolowo Way · Get directions →
        </p>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <SecondaryButton onClick={() => go("bookingTime")}>
          Reschedule
        </SecondaryButton>
        <SecondaryButton>Cancel visit</SecondaryButton>
      </div>
      <SectionTitle>
        Your preparation checklist · {ready.filter(Boolean).length} of 4 ready
      </SectionTitle>
      <Card className="space-y-5">
        {items.map(([title, detail], index) => (
          <Choice
            checked={ready[index]}
            detail={detail}
            key={title}
            onClick={() => {
              const next = [...ready]
              next[index] = !next[index]
              setReady(next)
            }}
            title={title}
          />
        ))}
      </Card>
      <Card>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon src={icons.sparklesRecord} />
          Your visit brief · AI prepared
        </div>
        <p className="mt-4 text-xs leading-[1.5] text-[#173b71]">
          Last visit: hypertension review on 28 Sep. Two current medicines.
          Latest haemoglobin: 10.2 g/dL, below the lab’s range. Review this
          summary before sharing.
        </p>
        <p className="mt-3 text-xs leading-[1.5] text-[#173b71]">
          Ask your clinician: What does my result mean? When should we repeat
          the test? What is the plan for my medicines?
        </p>
      </Card>
      <Guidance title="Coverage check">
        Reliance HMO is active. Consultation authorization is confirmed:
        RL-AU-51073. Additional tests may need separate approval.
      </Guidance>
      <PrimaryButton onClick={() => go("recordChat")}>
        Review visit summary & sharing
      </PrimaryButton>
      <SecondaryButton onClick={() => go("checkIn")}>
        Continue to check-in
      </SecondaryButton>
    </div>
  )
}

function CareJourney({ go }: { go: (screen: Screen) => void }) {
  const steps = [
    ["Registration", "WelliID verified · 9:20 AM", true],
    ["Triage", "Vitals recorded · 9:32 AM", true],
    ["Doctor · You are here", "Dr Amaka Bello · Appointment 10:30 AM", false],
    ["Laboratory", "Only if ordered by your clinician", false],
    ["Pharmacy", "Review any prescription after your visit", false],
    ["Payment & complete", "Review final bill and visit summary", false],
  ] as const
  return (
    <div className="stack">
      <Guidance title="Adaeze · WR-4821-0936">
        Visit LG-051026-073 · Checked in at 9:20 AM
        <br />
        You can keep your phone with you.
      </Guidance>
      <SectionTitle>Your care journey</SectionTitle>
      <Card>
        {steps.map(([title, detail, complete], index) => (
          <div className="grid grid-cols-[32px_1fr] gap-3" key={title}>
            <div className="flex flex-col items-center">
              <span
                className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
                  index === 2 || complete
                    ? "bg-[#031f50] text-white"
                    : "bg-[#edf2fa] text-[#53657c]"
                }`}
              >
                {complete ? <Icon size={14} src={icons.check} /> : index + 1}
              </span>
              {index < steps.length - 1 && (
                <span className="min-h-8 w-0.5 flex-1 bg-[#dae2ee]" />
              )}
            </div>
            <div className="pb-5">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs text-[#53657c]">{detail}</p>
            </div>
          </div>
        ))}
      </Card>
      <Guidance title="Waiting for your clinician">
        Please stay near the waiting area. Your slot is at 10:30 AM; timing may
        change. Ask reception if you need help or your symptoms worsen.
      </Guidance>
      <SectionTitle>This visit’s healthcare bill</SectionTitle>
      <Card>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">WelliPay</p>
          <Badge tone="amber">Payment due</Badge>
        </div>
        <p className="mt-5 text-[27px] font-bold">₦5,000</p>
        <p className="mt-3 text-xs leading-[1.45] text-[#53657c]">
          Bill LG-B051026-073
          <br />
          Registration fee · Not covered by HMO
          <br />
          Consultation: Reliance authorization confirmed.
          <br />
          No additional test charges yet.
        </p>
        <div className="mt-5">
          <PrimaryButton>View & pay healthcare bill</PrimaryButton>
        </div>
        <button className="mt-4 text-xs font-semibold">
          Request family payment · Bill only
        </button>
      </Card>
      <p className="text-xs leading-[1.45] text-[#53657c]">
        A payment request shares bill details, not your health record. Every
        authorized record access is logged.
      </p>
      <SecondaryButton onClick={() => go("home")}>
        Return to home
      </SecondaryButton>
    </div>
  )
}

function UploadReview({ onAdd }: { onAdd: () => void }) {
  const [reviewed, setReviewed] = useState(true)
  const fields = [
    ["Test name", "Haemoglobin"],
    ["Result", "10.2"],
    ["Units", "g/dL"],
    ["Laboratory reference range", "12.0–15.5 g/dL"],
    ["Report date", "29 Sep 2026"],
    ["Laboratory", "SYNLAB Ikeja"],
  ]
  return (
    <div className="stack">
      <div className="flex flex-wrap gap-2">
        <button className="flex items-center gap-1 rounded-full bg-[#edf2fa] px-3 py-2 text-xs font-semibold">
          <Icon size={14} src={icons.uploadReview} />
          PDF / image
        </button>
        <button className="flex items-center gap-1 rounded-full bg-[#edf2fa] px-3 py-2 text-xs font-semibold">
          <Icon size={14} src={icons.camera} />
          Camera
        </button>
        <button className="flex items-center gap-1 rounded-full bg-[#edf2fa] px-3 py-2 text-xs font-semibold">
          <Icon size={14} src={icons.scanDocument} />
          Scan
        </button>
      </div>
      <div className="rounded-[20px] bg-[#edf2fa] p-5">
        <div className="rounded-sm bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold">SYNLAB · LABORATORY REPORT</p>
          <p className="mt-3 text-[9px] text-[#53657c]">
            Adaeze Okafor · 29 Sep 2026
            <br />
            SL-290926-184 · Full blood count
          </p>
          <div className="mt-4 flex justify-between border-b border-[#dae2ee] pb-2 text-[9px]">
            <span>Haemoglobin</span>
            <strong>10.2 g/dL</strong>
            <span>12.0–15.5</span>
          </div>
          <div className="mt-2 h-1 bg-[#dae2ee]" />
          <div className="mt-2 h-1 bg-[#dae2ee]" />
        </div>
        <div className="mt-4 flex justify-between text-[11px] text-[#53657c]">
          <span>blood-count-sep.pdf · 284 KB</span>
          <span>Page 1 / 2</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge>Patient-uploaded</Badge>
        <Badge tone="amber">AI Extracted · Unconfirmed</Badge>
      </div>
      <h2 className="text-lg font-bold">
        We found the following information. Review before adding it to your
        record.
      </h2>
      <Card>
        <label className="text-xs text-[#53657c]">
          Category
          <select className="mt-2 h-12 w-full rounded-lg border border-[#031f50] bg-white px-3 text-sm text-[#031f50]">
            <option>Laboratory</option>
          </select>
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {fields.map(([label, value], index) => (
            <label
              className={`text-xs text-[#53657c] ${
                index === 0 || index === 3 ? "col-span-2" : ""
              }`}
              key={label}
            >
              {label}
              <span className="mt-2 flex min-h-12 items-center justify-between rounded-lg border border-[#dae2ee] bg-white px-3 text-sm text-[#031f50]">
                {value}
                <Icon size={15} src={icons.pencil} />
              </span>
            </label>
          ))}
        </div>
      </Card>
      <Guidance title="Possible duplicate found" tone="amber">
        This may match your verified SYNLAB report. Compare the files before
        saving. We will not auto-merge or replace either record.
      </Guidance>
      <Choice
        checked={reviewed}
        detail="Saving retains the original file and the AI extraction label. It does not verify the laboratory source."
        onClick={() => setReviewed(!reviewed)}
        title="I reviewed the extracted fields"
      />
      <PrimaryButton
        onClick={reviewed ? onAdd : undefined}
      >
        Confirm & add as Patient Added
      </PrimaryButton>
      <p className="text-center text-[11px] text-[#53657c]">
        No diagnosis is inferred. AI never silently rewrites your medical
        history.
      </p>
    </div>
  )
}

function RecordAdded({ go }: { go: (screen: Screen) => void }) {
  return (
    <div className="stack">
      <div className="flex flex-col items-center rounded-[20px] bg-[#edf2fa] p-[22px] text-center">
        <span className="flex size-[60px] items-center justify-center rounded-full bg-[#031f50]">
          <Icon size={28} src={icons.success} />
        </span>
        <h2 className="mt-4 text-[22px] font-bold">Record added</h2>
        <p className="mt-3 text-sm leading-[1.45] text-[#53657c]">
          Full blood count.pdf is now part of your health record.
        </p>
      </div>
      <Card>
        <Row
          detail="29 Sep 2026 · SYNLAB Ikeja"
          icon={icons.recordLab}
          title="Full blood count"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>Patient Added</Badge>
          <Badge tone="amber">AI Extracted · Reviewed</Badge>
        </div>
        <p className="mt-4 text-xs leading-[1.45] text-[#53657c]">
          The original PDF is retained. This does not verify the laboratory
          source or infer a diagnosis.
        </p>
      </Card>
      <PrimaryButton onClick={() => go("reports")}>View record</PrimaryButton>
      <SecondaryButton onClick={() => go("records")}>
        Return to My Health
      </SecondaryButton>
    </div>
  )
}

function ConsentExpanded({
  go,
  activeConsent,
  pendingConsent,
  onApprove,
  onReject,
}: {
  go: (screen: Screen) => void
  activeConsent: boolean
  pendingConsent: "pending" | "approved" | "rejected"
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className="stack">
      <div className="flex flex-wrap gap-2">
        <Badge>{activeConsent ? "2 active" : "1 active"}</Badge>
        {pendingConsent === "pending" && (
          <Badge tone="amber">1 pending</Badge>
        )}
        <Badge>{activeConsent ? "3 expired" : "4 expired"}</Badge>
      </div>
      <SectionTitle>Active permissions</SectionTitle>
      {activeConsent ? (
        <Card>
          <Row
            detail="Lagoon Hospital · Verified provider"
            icon={icons.recordStethoscope}
            title="Dr Amaka Bello"
          />
          <div className="mt-4">
            <Badge>Active</Badge>
          </div>
          <p className="mt-4 text-sm leading-[1.45] text-[#173b71]">
            Laboratory, medications & prescriptions, medical consultations ·
            Treatment follow-up
          </p>
          <p className="mt-3 text-xs leading-[1.45] text-[#53657c]">
            Consent C-1031 · Granted 3 Oct, 9:41 AM
            <br />
            Expires 4 Oct 2026, 9:41 AM · 24 hours
          </p>
          <button
            className="mt-4 text-xs font-semibold text-[#af4540]"
            onClick={() => go("revoke")}
          >
            Revoke access now
          </button>
        </Card>
      ) : (
        <Guidance title="Dr Amaka Bello access revoked">
          Future access under C-1031 has ended. The revocation is saved in
          Record Activity.
        </Guidance>
      )}
      <Card>
        <Row
          detail="Caregiver · Separate WelliID WR-7204-1683"
          icon={icons.people}
          title="Chidi Okafor · Husband"
        />
        <div className="mt-4">
          <Badge>Limited</Badge>
        </div>
        <p className="mt-4 text-sm text-[#173b71]">
          Medications & appointments only · Family support
        </p>
        <p className="mt-3 text-xs text-[#53657c]">
          Consent C-1024 · Expires 31 Oct 2026, 11:59 PM
        </p>
        <button className="mt-4 text-xs font-semibold text-[#24518c]">
          Manage or revoke caregiver access
        </button>
      </Card>
      {pendingConsent === "pending" ? (
        <>
          <SectionTitle>Pending your decision</SectionTitle>
          <Card className="bg-[#fbf2e3]">
            <Row
              detail="Requested 3 Oct, 9:10 AM · Verified laboratory"
              icon={icons.recordLab}
              title="SYNLAB Ikeja"
            />
            <div className="mt-4">
              <Badge tone="amber">Pending</Badge>
            </div>
            <p className="mt-4 text-sm leading-[1.45] text-[#173b71]">
              Laboratory category only · Compare previous results for a repeat
              test · Requested duration: 30 days
            </p>
            <p className="mt-3 text-xs text-[#53657c]">
              No access until you approve.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <PrimaryButton onClick={onApprove}>Approve</PrimaryButton>
              <SecondaryButton onClick={onReject}>Reject</SecondaryButton>
            </div>
          </Card>
        </>
      ) : (
        <Guidance
          title={
            pendingConsent === "approved"
              ? "SYNLAB request approved"
              : "SYNLAB request rejected"
          }
        >
          {pendingConsent === "approved"
            ? "Laboratory-only access is active for 30 days and has been added to Record Activity."
            : "No access was granted. Your decision has been added to Record Activity."}
        </Guidance>
      )}
      <SectionTitle action="All 3 →">Recently expired</SectionTitle>
      <Card>
        <Row
          detail="Prescription only · One-time access used 30 Sep · C-1026"
          icon={icons.pill}
          title="HealthPlus, Ikeja"
        />
        <div className="mt-3">
          <Badge>Expired</Badge>
        </div>
      </Card>
      <Guidance title="Revocation ends future access">
        It cannot undo a past view or erase records a provider must legally
        retain.
      </Guidance>
      <PrimaryButton onClick={() => go("recordActivity")}>
        Consent history & record activity
      </PrimaryButton>
      <SecondaryButton onClick={() => go("recordActivity")}>
        Review access history
      </SecondaryButton>
    </div>
  )
}

const activityItems = [
  [
    "You shared with Dr Amaka Bello",
    "3 Oct 2026 · 9:41 AM",
    "Laboratory, medicines & consultations",
    "Purpose: treatment follow-up · 24 hours",
    "C-1031 · Ends 4 Oct, 9:41 AM",
    "share",
  ],
  [
    "Chidi Okafor viewed your record",
    "2 Oct 2026 · 8:10 PM",
    "Current medication list",
    "Purpose: family support",
    "C-1024 · Caregiver grant to 31 Oct",
    "view",
  ],
  [
    "You revoked CityCare Clinic",
    "30 Sep 2026 · 4:20 PM",
    "Laboratory access ended immediately",
    "Reason: no longer needed · Added by you",
    "C-1018 · Revoked by patient",
    "revoke",
  ],
  [
    "HealthPlus viewed a prescription",
    "30 Sep 2026 · 11:05 AM",
    "Ferrous sulfate prescription · 28 Sep",
    "Purpose: dispensing · One-time access",
    "C-1026 · Used, now expired",
    "medicine",
  ],
  [
    "SYNLAB added your laboratory report",
    "29 Sep 2026 · 1:42 PM",
    "Full blood count · SL-290926-184",
    "Purpose: delivering your ordered test result",
    "C-1025 · Provider deposit permission",
    "add",
  ],
] as const

function RecordActivity({
  activeConsent,
  pendingConsent,
}: {
  activeConsent: boolean
  pendingConsent: "pending" | "approved" | "rejected"
}) {
  const activityIcon = {
    share: icons.send,
    view: icons.activityEye,
    revoke: icons.activityShieldX,
    medicine: icons.pill,
    add: icons.files,
  }
  return (
    <div className="stack">
      <div className="flex gap-2 overflow-x-auto">
        {["All activity", "Last 30 days", "Filters"].map((filter) => (
          <button
            className="whitespace-nowrap rounded-full border border-[#dae2ee] bg-white px-3 py-2 text-xs font-semibold"
            key={filter}
          >
            {filter}
          </button>
        ))}
      </div>
      <Guidance title="An access history you can understand">
        Each entry links the recipient, selected scope, purpose, duration and
        consent. Provider additions keep their original source.
      </Guidance>
      {!activeConsent && (
        <Card>
          <Row
            detail="Today · Confirmed by you"
            icon={icons.activityShieldX}
            title="You revoked Dr Amaka Bello"
          />
          <p className="mt-4 text-sm font-semibold text-[#173b71]">
            Future access under C-1031 ended
          </p>
          <div className="mt-3">
            <Badge tone="red">Revoked</Badge>
          </div>
        </Card>
      )}
      {pendingConsent !== "pending" && (
        <Card>
          <Row
            detail="Today · Consent request C-1032"
            icon={icons.recordLab}
            title={`You ${pendingConsent} SYNLAB Ikeja’s request`}
          />
          <p className="mt-4 text-xs text-[#53657c]">
            {pendingConsent === "approved"
              ? "Laboratory-only access granted for 30 days."
              : "No record access was granted."}
          </p>
        </Card>
      )}
      {activityItems.map(([title, date, scope, purpose, consent, icon]) => (
        <Card key={title}>
          <Row detail={date} icon={activityIcon[icon]} title={title} />
          <p className="mt-4 text-sm font-semibold text-[#173b71]">{scope}</p>
          <p className="mt-2 text-xs text-[#53657c]">{purpose}</p>
          <div className="mt-3">
            <Badge>{consent}</Badge>
          </div>
        </Card>
      ))}
      <PrimaryButton>Download my access history</PrimaryButton>
      <p className="text-center text-xs text-[#53657c]">
        Questions about an access? Flag the entry for review.
      </p>
    </div>
  )
}

function EmergencyQr({
  active,
  onActivate,
}: {
  active: boolean
  onActivate: () => void
}) {
  return (
    <div className="stack">
      <Card className="text-center">
        <img
          alt="Secure emergency QR code"
          className="mx-auto size-36"
          src={icons.emergencyQr}
        />
        <p className="mt-4 text-sm font-semibold">
          Adaeze Okafor · WR-4821-0936
        </p>
        <p className="mt-3 text-xs leading-[1.45] text-[#53657c]">
          Scanning opens a secure emergency interface, not your complete health
          record. Online authorization is required.
        </p>
      </Card>
      <div className="flex items-center justify-between">
        <SectionTitle>Your authorized emergency fields</SectionTitle>
        <button className="text-xs font-semibold text-[#24518c]">Edit</button>
      </div>
      <Card className="space-y-4">
        {[
          ["Identity, blood group & genotype", "Adaeze Okafor · O+ · AA"],
          [
            "Allergy & important condition",
            "Penicillin: rash · Hypertension",
          ],
          ["Medication relevant to emergency care", "Amlodipine 5 mg daily"],
          [
            "Emergency contact",
            "Chidi Okafor · +234 803 555 0142",
          ],
        ].map(([title, detail]) => (
          <Choice checked detail={detail} key={title} title={title} />
        ))}
        <p className="text-xs text-[#53657c]">
          Lab history, documents and full record are excluded.
        </p>
      </Card>
      <Guidance title="Authorized emergency personnel only">
        Each access is limited to 10 minutes and logged with the viewer, time
        and emergency purpose.
      </Guidance>
      <Guidance title="Offline copy · Last synced today, 08:42">
        Essentials are stored on this device. This copy may miss changes since
        sync. QR authorization needs connectivity.
      </Guidance>
      <Guidance title="Before you activate emergency mode" tone="amber">
        We will notify Chidi and share only the selected essentials with him for
        10 minutes. Your location stays off unless you opt in.
      </Guidance>
      {active && (
        <Guidance title="Emergency sharing is active">
          Your selected essentials are currently shared. Open the emergency
          screen to review or end access.
        </Guidance>
      )}
      <PrimaryButton danger onClick={onActivate}>
        {active ? "View active emergency" : "I’m in an emergency"}
      </PrimaryButton>
      <SecondaryButton>Save emergency QR card</SecondaryButton>
    </div>
  )
}

function EmergencyInfo({ onEnd }: { onEnd: () => void }) {
  return (
    <div className="stack">
      <div className="rounded-[20px] bg-[#af4540] p-5 text-white">
        <p className="text-[10px] font-semibold">EMERGENCY INFORMATION</p>
        <h2 className="mt-2 text-lg font-bold">“I’m in an emergency” is active</h2>
        <p className="mt-2 text-xs text-[#faedea]">
          Started 3 Oct at 9:40 AM · Essentials only
          <br />
          Emergency sharing ends at 9:50 AM.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card><p className="text-xs text-[#53657c]">Blood group</p><p className="mt-2 text-xl font-bold">O+</p></Card>
        <Card><p className="text-xs text-[#53657c]">Genotype</p><p className="mt-2 text-xl font-bold">AA</p></Card>
      </div>
      <Card className="border-[#faedea] bg-[#faedea]">
        <p className="text-[10px] font-semibold text-[#af4540]">ALLERGY ALERT</p>
        <h3 className="mt-2 text-lg font-bold text-[#af4540]">Penicillin</h3>
        <p className="mt-2 text-xs text-[#936020]">
          Recorded reaction: rash · Provider confirmed
        </p>
      </Card>
      <Card>
        <p className="text-[10px] font-semibold">IMPORTANT CONDITION & MEDICATION</p>
        <h3 className="mt-3 text-sm font-semibold">Hypertension</h3>
        <p className="mt-2 text-sm">Amlodipine 5 mg · Once daily</p>
        <p className="mt-2 text-xs text-[#53657c]">
          Source: Lagoon Hospital · Dr Bello · 28 Sep 2026
        </p>
      </Card>
      <Card>
        <Row
          detail="+234 803 555 0142 · Tap to call"
          icon={icons.emergencyPhone}
          title="Chidi Okafor · Husband"
        />
        <div className="mt-3"><Badge>Selected contact notified · 9:40 AM</Badge></div>
        <p className="mt-3 text-xs text-[#53657c]">
          Shared with Chidi: identity, O+/AA, allergy, hypertension and
          amlodipine. Grant E-1032 · 10 minutes · Logged.
        </p>
      </Card>
      <Guidance title="Location sharing is off">
        Your location was not sent. Share only if you choose.
      </Guidance>
      <Guidance title="This does not dispatch emergency services" tone="amber">
        Contact notification does not guarantee a response. Seek local
        emergency help directly.
      </Guidance>
      <PrimaryButton danger onClick={onEnd}>
        End emergency sharing
      </PrimaryButton>
    </div>
  )
}

function HealthPassport() {
  return (
    <div className="stack">
      <Card className="border-[#031f50] bg-[#031f50] text-white">
        <div className="flex items-center gap-2">
          <Icon size={20} src={icons.passportGlobe} />
          <p className="text-sm font-semibold">Adaeze Okafor</p>
        </div>
        <p className="mt-3 text-xs text-[#e0e9f8]">
          WR-4821-0936 · Patient-reviewed summary
          <br />
          Reviewed by you · 3 Oct 2026, 9:30 AM
        </p>
      </Card>
      <SectionTitle>Choose what travels with you</SectionTitle>
      <Card className="space-y-4">
        {[
          ["Selected medical history", "Hypertension · 28 Sep consultation summary"],
          ["Allergies", "Penicillin · Recorded reaction: rash"],
          ["Current medicines", "Amlodipine 5 mg · Ferrous sulfate 200 mg"],
          ["Selected vaccinations", "Td booster · 18 Jun 2026 · Lagoon Hospital"],
          ["Emergency basics & contact", "O+ · AA · Chidi Okafor · +234 803 555 0142"],
          ["Selected document", "Td vaccination certificate · 1 PDF"],
        ].map(([title, detail]) => (
          <Choice checked detail={detail} key={title} title={title} />
        ))}
        <Choice
          checked={false}
          detail="Excluded from this passport"
          title="All lab reports & imaging"
        />
      </Card>
      <SectionTitle>Recipient & duration</SectionTitle>
      <Card className="space-y-4">
        <label className="text-xs text-[#53657c]">
          Selected recipient
          <select className="mt-2 h-12 w-full rounded-lg border border-[#dae2ee] bg-white px-3 text-sm text-[#031f50]">
            <option>Dr Nina Patel · Travel clinic, London</option>
          </select>
        </label>
        <label className="block text-xs text-[#53657c]">
          Purpose
          <input className="mt-2 h-12 w-full rounded-lg border border-[#dae2ee] px-3 text-sm text-[#031f50]" defaultValue="Travel health consultation" />
        </label>
        <label className="block text-xs text-[#53657c]">
          Secure access duration
          <select className="mt-2 h-12 w-full rounded-lg border border-[#dae2ee] bg-white px-3 text-sm text-[#031f50]">
            <option>7 days · Ends 10 Oct 2026, 9:41 AM</option>
          </select>
        </label>
      </Card>
      <Guidance title="Portable, not unrestricted" tone="amber">
        Only your selected summary is included. A secure link can expire or be
        revoked; a downloaded PDF cannot be recalled.
      </Guidance>
      <PrimaryButton>Preview & export selected PDF</PrimaryButton>
      <SecondaryButton>Structured exchange · Where supported</SecondaryButton>
      <p className="text-xs leading-[1.45] text-[#53657c]">
        You can take your data with you without paying for access. Original
        records are preserved.
      </p>
    </div>
  )
}

const nav = [
  ["home", icons.homeNav, "Home"],
  ["records", icons.files, "My Health"],
  ["careDiscovery", icons.stethoscope, "Care"],
  ["consentExpanded", icons.send, "Share"],
  ["profile", icons.fingerprint, "Profile"],
] as const

type DeviceMode = "iphone" | "pixel" | "compact" | "fluid"

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  iphone: "sm:max-w-[402px]",
  pixel: "sm:max-w-[412px]",
  compact: "sm:max-w-[375px]",
  fluid: "sm:max-w-md w-full",
}

const SCREEN_GROUPS: { group: string; screens: { id: Screen; label: string }[] }[] = [
  {
    group: "Core & Dashboard",
    screens: [
      { id: "home", label: "Home Dashboard" },
      { id: "healthPassport", label: "Health Passport" },
    ],
  },
  {
    group: "Health Records & AI",
    screens: [
      { id: "records", label: "My Health Vault" },
      { id: "timeline", label: "Health Timeline" },
      { id: "reports", label: "Lab Reports" },
      { id: "result", label: "Result Detail & AI Explain" },
      { id: "medications", label: "Medications List" },
      { id: "recordChat", label: "Ask Welli AI Chat" },
      { id: "uploadReview", label: "Upload & Review Record" },
      { id: "recordAdded", label: "Record Added Confirmed" },
      { id: "emptyVault", label: "Empty Records Vault" },
    ],
  },
  {
    group: "Care & Appointments",
    screens: [
      { id: "careDiscovery", label: "Care Discovery / Search" },
      { id: "bookingTime", label: "Select Appointment Time" },
      { id: "bookingReview", label: "Review Booking" },
      { id: "bookingConfirmed", label: "Booking Confirmed" },
      { id: "visitPrep", label: "Visit Preparation" },
      { id: "checkIn", label: "Hospital Check-In" },
      { id: "checkedIn", label: "Checked In Pass" },
      { id: "careJourney", label: "Care Journey Timeline" },
    ],
  },
  {
    group: "Consent & Privacy",
    screens: [
      { id: "consentExpanded", label: "Consent Center" },
      { id: "revoke", label: "Revoke Access Flow" },
      { id: "shared", label: "Consent Shared Receipt" },
      { id: "recordActivity", label: "Activity Audit Log" },
    ],
  },
  {
    group: "Emergency & Safety",
    screens: [
      { id: "emergencyQr", label: "Emergency QR Code" },
      { id: "emergencyInfo", label: "Emergency Medical Info" },
      { id: "lostPhone", label: "Lost Phone Security" },
    ],
  },
  {
    group: "Onboarding & Auth",
    screens: [
      { id: "welcome", label: "Welcome Screen" },
      { id: "signIn", label: "Sign In (Passkey)" },
      { id: "createAccount", label: "Create Account" },
      { id: "verifyPhone", label: "Verify Phone / OTP" },
      { id: "onboardingId", label: "Onboarding: Welli ID" },
      { id: "onboardingRecord", label: "Onboarding: Upload Record" },
    ],
  },
  {
    group: "Account & System",
    screens: [
      { id: "profile", label: "Profile & Settings" },
      { id: "preferences", label: "Preferences" },
      { id: "recoverAccount", label: "Recover Account" },
      { id: "verifyRecovery", label: "Verify Recovery" },
      { id: "recovered", label: "Account Recovered" },
      { id: "offline", label: "Offline Mode" },
      { id: "uploadFailed", label: "Upload Failed Error" },
      { id: "labsLoading", label: "Labs Loading State" },
    ],
  },
]

function MobileStatusBar({ time }: { time: string }) {
  return (
    <div className="shrink-0 flex items-center justify-between px-6 pt-3 pb-1 text-[#031f50] select-none text-[12px] font-semibold bg-white/95 backdrop-blur z-30">
      <span className="w-12 tracking-tight font-medium">{time}</span>
      <div className="flex items-center justify-center">
        {/* Dynamic Island */}
        <div className="h-5 w-24 bg-black rounded-full flex items-center justify-end pr-2.5 shadow-inner">
          <div className="size-2 rounded-full bg-[#1c1c1e] ring-1 ring-white/10" />
        </div>
      </div>
      <div className="w-12 flex items-center justify-end gap-1.5 text-[#031f50]">
        {/* Signal Bars */}
        <svg className="size-3 fill-current" viewBox="0 0 24 24">
          <path d="M2 20h3V10H2v10zm6 0h3V7H8v13zm6 0h3V4h-3v16zm6-19v19h3V1h-3z" />
        </svg>
        {/* Wi-Fi */}
        <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
          <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98A16.88 16.88 0 0012 4zm0 4.5c3.34 0 6.36 1.35 8.56 3.54L12 20.15 3.44 12.04C5.64 9.85 8.66 8.5 12 8.5z" />
        </svg>
        {/* Battery */}
        <div className="flex items-center">
          <div className="h-2.5 w-5 rounded-[3px] border border-current p-[1px]">
            <div className="h-full w-full rounded-[1px] bg-[#10b981]" />
          </div>
          <div className="h-1 w-[1.5px] rounded-r-sm bg-current" />
        </div>
      </div>
    </div>
  )
}

function MobileHomeIndicator() {
  return (
    <div className="shrink-0 flex justify-center py-1.5 select-none pointer-events-none bg-white">
      <div className="h-1 w-28 rounded-full bg-[#031f50]/20" />
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    if (typeof window === "undefined") return "welcome"
    return window.localStorage.getItem("wellirecord-setup-complete") === "true"
      ? "signIn"
      : "welcome"
  })
  const [screenHistory, setScreenHistory] = useState<Screen[]>([])
  const [setupFlow, setSetupFlow] = useState(false)
  const [recordAdded, setRecordAdded] = useState(false)
  const [careStage, setCareStage] = useState<
    "scheduled" | "booked" | "checkedIn"
  >("scheduled")
  const [activeConsent, setActiveConsent] = useState(true)
  const [pendingConsent, setPendingConsent] = useState<
    "pending" | "approved" | "rejected"
  >("pending")
  const [emergencyActive, setEmergencyActive] = useState(false)
  const [activeBottomSheet, setActiveBottomSheet] = useState<
    "filter" | "shareConsent" | "emergencyQr" | null
  >(null)
  const [activeFilter, setActiveFilter] = useState("All")
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToastMessage(msg)
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null)
    }, 2800)
  }
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("iphone")
  const [currentTime, setCurrentTime] = useState("9:41")
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes().toString().padStart(2, "0")
      setCurrentTime(`${hours}:${minutes}`)
    }
    updateTime()
    const timer = setInterval(updateTime, 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
  }, [screen])

  const mainScreen = nav.some(([id]) => id === screen)
  const entryScreens: Screen[] = [
    "welcome",
    "signIn",
    "createAccount",
    "verifyPhone",
    "onboardingId",
    "onboardingRecord",
    "recoverAccount",
    "verifyRecovery",
    "recovered",
  ]
  const showNavigation = !entryScreens.includes(screen)
  const go = (next: Screen) => {
    if (next === screen) return
    triggerHaptic("light")
    setScreenHistory((current) => [...current, screen])
    setScreen(next)
    contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
    window.scrollTo({ top: 0, behavior: "auto" })
  }
  const goBack = () => {
    triggerHaptic("light")
    setScreenHistory((current) => {
      const previous = current.at(-1)
      if (!previous) return current
      setScreen(previous)
      contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
      window.scrollTo({ top: 0, behavior: "auto" })
      return current.slice(0, -1)
    })
  }
  const openSection = (next: (typeof nav)[number][0]) => {
    triggerHaptic("light")
    setScreenHistory([])
    setScreen(next)
    contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
    window.scrollTo({ top: 0, behavior: "auto" })
  }
  const addRecord = () => {
    setRecordAdded(true)
    if (setupFlow && typeof window !== "undefined") {
      window.localStorage.setItem("wellirecord-setup-complete", "true")
      setSetupFlow(false)
    }
    go("recordAdded")
  }
  const startAccountCreation = () => {
    setSetupFlow(true)
    go("createAccount")
  }
  const completeOnboarding = (next: Screen) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("wellirecord-setup-complete", "true")
    }
    setSetupFlow(false)
    setScreenHistory([])
    setScreen(next)
    contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
    window.scrollTo({ top: 0, behavior: "auto" })
  }
  const signIn = () => {
    setSetupFlow(false)
    setScreenHistory([])
    setScreen("home")
    contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
    window.scrollTo({ top: 0, behavior: "auto" })
  }
  const signOut = () => {
    setScreenHistory([])
    setScreen("signIn")
    contentRef.current?.scrollTo({ top: 0, behavior: "auto" })
    window.scrollTo({ top: 0, behavior: "auto" })
  }
  const confirmBooking = () => {
    setCareStage("booked")
    go("bookingConfirmed")
  }
  const confirmCheckIn = () => {
    setCareStage("checkedIn")
    go("checkedIn")
  }
  const confirmRevocation = () => {
    setActiveConsent(false)
    go("consentExpanded")
  }
  const activateEmergency = () => {
    setEmergencyActive(true)
    go("emergencyInfo")
  }
  const endEmergency = () => {
    setEmergencyActive(false)
    go("emergencyQr")
  }
  const healthScreens: Screen[] = [
    "records",
    "timeline",
    "reports",
    "result",
    "medications",
    "emptyVault",
    "offline",
    "uploadFailed",
    "labsLoading",
    "recordChat",
    "uploadReview",
    "healthPassport",
    "recordAdded",
  ]
  const careScreens: Screen[] = [
    "careDiscovery",
    "bookingTime",
    "bookingReview",
    "bookingConfirmed",
    "visitPrep",
    "checkIn",
    "checkedIn",
    "careJourney",
  ]
  const shareScreens: Screen[] = [
    "consentExpanded",
    "revoke",
    "shared",
    "recordActivity",
  ]
  const activeSection =
    screen === "home"
      ? "home"
      : healthScreens.includes(screen)
        ? "records"
        : careScreens.includes(screen)
          ? "careDiscovery"
          : shareScreens.includes(screen)
            ? "consentExpanded"
            : "profile"
  const helpScreens: Screen[] = [
    "welcome",
    "signIn",
    "createAccount",
    "verifyPhone",
    "onboardingId",
    "onboardingRecord",
    "recoverAccount",
    "verifyRecovery",
    "preferences",
  ]
  const headerAction = helpScreens.includes(screen)
    ? "help"
    : screen === "home"
      ? "notifications"
      : "avatar"
  const titles: Record<Screen, string> = {
    home: "Good morning, Adaeze",
    records: "My health records",
    timeline: "Health timeline",
    medications: "My medicines",
    profile: "My profile",
    reports: "Laboratory reports",
    result: "Understand this result",
    revoke: "Review consent",
    shared: "Consent confirmed",
    lostPhone: "Security",
    recovered: "Account recovery",
    verifyRecovery: "Account recovery",
    recoverAccount: "Account recovery",
    emptyVault: "My health records",
    preferences: "Preferences",
    createAccount: "Create account",
    welcome: "Welcome to WelliRecord",
    bookingReview: "Book an appointment",
    bookingTime: "Book an appointment",
    offline: "Saved offline",
    uploadFailed: "Document upload",
    labsLoading: "Laboratory reports",
    onboardingRecord: "Set up WelliRecord",
    onboardingId: "Set up WelliRecord",
    verifyPhone: "Verify your contact",
    checkedIn: "Visit check-in",
    checkIn: "Visit check-in",
    bookingConfirmed: "Appointment",
    recordChat: "Ask about my records",
    careDiscovery: "Care, closer to you",
    visitPrep: "Prepare for your visit",
    careJourney: "Your care journey",
    uploadReview: "Review your upload",
    consentExpanded: "Consent Center",
    recordActivity: "Your record activity",
    emergencyQr: "Your emergency QR",
    emergencyInfo: "Emergency information",
    healthPassport: "Your Health Passport",
    recordAdded: "Record added",
    signIn: "Sign in",
  }

  return (
    <div className="min-h-dvh bg-[#0d1527] text-[#031f50] flex flex-col items-center justify-start sm:p-4 md:p-6 transition-colors">
      {/* Desktop Mobile Simulator Top Bar */}
      <header className="w-full max-w-4xl mb-4 hidden sm:flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-white shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center size-8 rounded-xl bg-gradient-to-br from-[#24518c] to-[#031f50] text-white shadow-md">
            <span className="text-base">📱</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight">WelliRecord</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Mobile App
              </span>
            </div>
            <p className="text-[11px] text-slate-300 truncate">Patient Health Record & Clinic Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Screen Quick Jump Dropdown */}
          <div className="relative flex items-center">
            <label htmlFor="screen-select" className="sr-only">Jump to Screen</label>
            <select
              id="screen-select"
              aria-label="Jump to screen"
              value={screen}
              onChange={(e) => go(e.target.value as Screen)}
              className="text-xs font-semibold bg-[#1e293b] text-white border border-white/20 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer shadow-sm"
            >
              {SCREEN_GROUPS.map((grp) => (
                <optgroup key={grp.group} label={`── ${grp.group} ──`}>
                  {grp.screens.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({s.id})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Device Model Selector */}
          <div className="flex items-center rounded-xl bg-[#1e293b] p-0.5 border border-white/15 text-xs font-medium">
            <button
              onClick={() => setDeviceMode("iphone")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                deviceMode === "iphone" ? "bg-[#2563eb] text-white shadow-sm font-semibold" : "text-slate-400 hover:text-white"
              }`}
              title="iPhone 16 Pro (402px)"
            >
              iPhone
            </button>
            <button
              onClick={() => setDeviceMode("pixel")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                deviceMode === "pixel" ? "bg-[#2563eb] text-white shadow-sm font-semibold" : "text-slate-400 hover:text-white"
              }`}
              title="Pixel 9 (412px)"
            >
              Pixel
            </button>
            <button
              onClick={() => setDeviceMode("compact")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                deviceMode === "compact" ? "bg-[#2563eb] text-white shadow-sm font-semibold" : "text-slate-400 hover:text-white"
              }`}
              title="Compact Phone (375px)"
            >
              375px
            </button>
            <button
              onClick={() => setDeviceMode("fluid")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                deviceMode === "fluid" ? "bg-[#2563eb] text-white shadow-sm font-semibold" : "text-slate-400 hover:text-white"
              }`}
              title="Fluid Full View"
            >
              Fluid
            </button>
          </div>

          {/* Reset / Sign Out */}
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.localStorage.removeItem("wellirecord-setup-complete")
              }
              setScreenHistory([])
              setScreen("welcome")
            }}
            className="text-xs px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors font-medium border border-white/10"
            title="Reset flow to Welcome screen"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Mobile Device Frame Container */}
      <div
        className={`w-full ${DEVICE_WIDTHS[deviceMode]} sm:h-[870px] sm:max-h-[calc(100dvh-100px)] min-h-dvh sm:min-h-0 flex flex-col bg-[#f7f9fc] text-[#031f50] relative overflow-hidden sm:rounded-[50px] sm:border-[10px] sm:border-[#1e293b] sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.15)] transition-all duration-300`}
      >
        {/* Mobile Status Bar */}
        <MobileStatusBar time={currentTime} />

        {/* Mobile App Header */}
        <header className="shrink-0 border-b border-[#e7ecf4] bg-white/95 backdrop-blur z-20">
          <div className="flex h-14 items-center gap-2.5 px-4">
            {!mainScreen && screenHistory.length > 0 && (
              <button
                aria-label="Go back"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#edf2fa] text-lg font-bold transition-transform active:scale-90"
                onClick={goBack}
              >
                ‹
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold tracking-[-0.02em] text-[#24518c] leading-tight">
                Welli<span className="text-[#031f50]">Record</span>
              </p>
              <h1 className="truncate text-base font-bold text-[#031f50] leading-tight">
                {titles[screen]}
              </h1>
            </div>
            {headerAction === "help" && (
              <button className="text-xs font-semibold text-[#031f50] px-2.5 py-1 rounded-full bg-[#edf2fa]">
                Help
              </button>
            )}
            {headerAction === "notifications" && (
              <button
                aria-label="Notifications"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#edf2fa] transition-transform active:scale-95"
              >
                <Icon src={icons.bell} size={18} />
              </button>
            )}
            {headerAction === "avatar" && (
              <button
                aria-label="Open profile"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#edf2fa] text-[11px] font-bold text-[#031f50] transition-transform active:scale-95"
                onClick={() => openSection("profile")}
              >
                AO
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Screen Content Container */}
        <main
          ref={contentRef}
          className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-6"
        >
          <div key={screen} className="animate-screen-enter">
            {screen === "home" && (
              <Home
                careStage={careStage}
                go={go}
                openShare={() => setActiveBottomSheet("shareConsent")}
                openEmergency={() => setActiveBottomSheet("emergencyQr")}
              />
            )}
            {screen === "records" && (
              <Records
                go={go}
                recordAdded={recordAdded}
                openFilter={() => setActiveBottomSheet("filter")}
                showToast={showToast}
                activeFilter={activeFilter}
                onClearFilter={() => setActiveFilter("All")}
              />
            )}
            {screen === "timeline" && (
              <Timeline
                go={go}
                openFilter={() => setActiveBottomSheet("filter")}
                showToast={showToast}
                activeFilter={activeFilter}
                onClearFilter={() => setActiveFilter("All")}
              />
            )}
            {screen === "reports" && <Reports go={go} />}
            {screen === "result" && <Result go={go} />}
            {screen === "medications" && <Medications />}
            {screen === "profile" && <Profile go={go} onSignOut={signOut} />}
            {screen === "revoke" && (
              <Outcome
                go={go}
                kind="revoke"
                onConfirmRevoke={confirmRevocation}
              />
            )}
            {screen === "shared" && <Outcome go={go} kind="shared" />}
            {screen === "lostPhone" && <LostPhone go={go} />}
            {screen === "recovered" && <Recovered go={go} />}
            {screen === "verifyRecovery" && <VerifyRecovery go={go} />}
            {screen === "recoverAccount" && <RecoverAccount go={go} />}
            {screen === "emptyVault" && <EmptyVault go={go} />}
            {screen === "preferences" && <Preferences go={go} />}
            {screen === "createAccount" && <CreateAccount go={go} />}
            {screen === "welcome" && (
              <Welcome go={go} onCreateAccount={startAccountCreation} />
            )}
            {screen === "signIn" && (
              <SignIn
                go={go}
                onCreateAccount={startAccountCreation}
                onSignIn={signIn}
              />
            )}
            {screen === "bookingReview" && (
              <BookingReview go={go} onConfirm={confirmBooking} />
            )}
            {screen === "bookingTime" && <BookingTime go={go} />}
            {screen === "offline" && <Offline go={go} />}
            {screen === "uploadFailed" && <UploadFailed go={go} />}
            {screen === "labsLoading" && <LabsLoading go={go} />}
            {screen === "onboardingRecord" && (
              <OnboardingRecord go={go} onComplete={completeOnboarding} />
            )}
            {screen === "onboardingId" && <OnboardingId go={go} />}
            {screen === "verifyPhone" && <VerifyPhone go={go} />}
            {screen === "checkedIn" && <CheckedIn go={go} />}
            {screen === "checkIn" && <CheckIn onCheckIn={confirmCheckIn} />}
            {screen === "bookingConfirmed" && <BookingConfirmed go={go} />}
            {screen === "recordChat" && <RecordChat go={go} />}
            {screen === "careDiscovery" && <CareDiscovery go={go} />}
            {screen === "visitPrep" && <VisitPrep go={go} />}
            {screen === "careJourney" && <CareJourney go={go} />}
            {screen === "uploadReview" && <UploadReview onAdd={addRecord} />}
            {screen === "recordAdded" && <RecordAdded go={go} />}
            {screen === "consentExpanded" && (
              <ConsentExpanded
                activeConsent={activeConsent}
                go={go}
                onApprove={() => setPendingConsent("approved")}
                onReject={() => setPendingConsent("rejected")}
                pendingConsent={pendingConsent}
              />
            )}
            {screen === "recordActivity" && (
              <RecordActivity
                activeConsent={activeConsent}
                pendingConsent={pendingConsent}
              />
            )}
            {screen === "emergencyQr" && (
              <EmergencyQr
                active={emergencyActive}
                onActivate={activateEmergency}
              />
            )}
            {screen === "emergencyInfo" && <EmergencyInfo onEnd={endEmergency} />}
            {screen === "healthPassport" && <HealthPassport />}
          </div>
        </main>

        {/* Bottom Navigation Bar */}
        {showNavigation && (
          <nav className="shrink-0 border-t border-[#dae2ee] bg-white/98 z-30 select-none">
            <div className="grid h-16 grid-cols-5 px-1">
              {nav.map(([id, icon, label]) => (
                <button
                  className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-transform active:scale-95 ${
                    activeSection === id ? "text-[#031f50]" : "text-[#718096]"
                  }`}
                  key={id}
                  onClick={() => openSection(id)}
                >
                  <span
                    className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${
                      activeSection === id ? "bg-[#edf2fa]" : ""
                    }`}
                  >
                    <Icon src={icon} size={18} />
                  </span>
                  <span className="leading-tight">{label}</span>
                </button>
              ))}
            </div>
            <MobileHomeIndicator />
          </nav>
        )}

        {/* Native Mobile Polish Bottom Sheets */}
        <FilterBottomSheet
          isOpen={activeBottomSheet === "filter"}
          onClose={() => setActiveBottomSheet(null)}
          onApply={(filterType) => {
            setActiveFilter(filterType)
            showToast(`Filter applied: ${filterType} records`)
          }}
        />
        <ShareConsentBottomSheet
          isOpen={activeBottomSheet === "shareConsent"}
          onClose={() => setActiveBottomSheet(null)}
          onShare={(doc) => {
            setActiveConsent(true)
            showToast(`Shared encrypted access pass with ${doc} ✓`)
          }}
        />
        <EmergencyQrBottomSheet
          isOpen={activeBottomSheet === "emergencyQr"}
          onClose={() => setActiveBottomSheet(null)}
          onCopy={() => {
            showToast("Emergency Medical Pass copied to clipboard ✓")
          }}
        />

        {/* Floating Haptic Toast Notification */}
        <ToastNotification
          message={toastMessage}
          onDismiss={() => setToastMessage(null)}
        />
      </div>
    </div>
  )
}
