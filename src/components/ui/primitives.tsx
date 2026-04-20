import React, { forwardRef } from 'react';

type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export const Button = forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        variant?: ButtonVariant;
        size?: ButtonSize;
        block?: boolean;
    }
>(({ variant = 'ghost', size = 'md', block, className = '', ...rest }, ref) => {
    const classes = [
        'cm-btn',
        `cm-btn--${variant}`,
        size !== 'md' ? `cm-btn--${size}` : '',
        block ? 'w-full' : '',
        className
    ]
        .filter(Boolean)
        .join(' ');
    return <button ref={ref} className={classes} {...rest} />;
});
Button.displayName = 'Button';

export function Card({
    children,
    className = '',
    pad = true
}: {
    children: React.ReactNode;
    className?: string;
    pad?: boolean;
}) {
    return <div className={`cm-card ${pad ? 'cm-card--pad' : ''} ${className}`}>{children}</div>;
}

export function SectionHeader({
    eyebrow,
    title,
    actions
}: {
    eyebrow?: string;
    title: string;
    actions?: React.ReactNode;
}) {
    return (
        <div className="flex items-end justify-between gap-3 mb-3">
            <div>
                {eyebrow && <div className="cm-label mb-1">{eyebrow}</div>}
                <h3 className="text-base font-semibold leading-tight">{title}</h3>
            </div>
            {actions}
        </div>
    );
}

export function Field({
    label,
    hint,
    children,
    inline
}: {
    label?: string;
    hint?: string;
    children: React.ReactNode;
    inline?: boolean;
}) {
    return (
        <div className={inline ? 'flex items-center gap-3' : 'flex flex-col gap-1.5'}>
            {label && <span className="cm-label">{label}</span>}
            <div className={inline ? 'flex-1' : ''}>{children}</div>
            {hint && <span className="text-xs text-[color:var(--color-muted)]">{hint}</span>}
        </div>
    );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    const { className = '', ...rest } = props;
    return <input className={`cm-input ${className}`} {...rest} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
    const { className = '', children, ...rest } = props;
    return (
        <select className={`cm-select ${className}`} {...rest}>
            {children}
        </select>
    );
}

export function Slider({
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    label,
    format
}: {
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    format?: (v: number) => string;
}) {
    const display = format ? format(value) : String(value);
    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <div className="flex items-center justify-between gap-2">
                    <span className="cm-label">{label}</span>
                    <span className="text-xs font-mono tabular-nums text-[color:var(--color-ink)]">
                        {display}
                    </span>
                </div>
            )}
            <input
                type="range"
                className="cm-range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
            />
        </div>
    );
}

export function Toggle({
    checked,
    onChange,
    label
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label?: string;
}) {
    return (
        <label className="flex items-center gap-3 cursor-pointer select-none">
            <span className="cm-switch">
                <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
                <span className="cm-switch__track">
                    <span className="cm-switch__thumb" />
                </span>
            </span>
            {label && <span className="text-sm">{label}</span>}
        </label>
    );
}

export interface SegmentedOption<T extends string> {
    value: T;
    label: React.ReactNode;
    disabled?: boolean;
}

export function Segmented<T extends string>({
    value,
    onChange,
    options,
    className = ''
}: {
    value: T;
    onChange: (v: T) => void;
    options: SegmentedOption<T>[];
    className?: string;
}) {
    return (
        <div className={`cm-seg ${className}`} role="tablist">
            {options.map((o) => (
                <button
                    key={o.value}
                    role="tab"
                    aria-pressed={value === o.value}
                    disabled={o.disabled}
                    onClick={() => onChange(o.value)}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function FileDrop({
    accept,
    onFile,
    label,
    sub,
    fileName
}: {
    accept: string;
    onFile: (f: File) => void;
    label: string;
    sub?: string;
    fileName?: string | null;
}) {
    const [drag, setDrag] = React.useState(false);
    const ref = React.useRef<HTMLInputElement>(null);
    const hasFile = !!fileName;
    return (
        <label
            className="cm-drop block"
            data-has-file={hasFile}
            onDragEnter={(e) => {
                e.preventDefault();
                setDrag(true);
            }}
            onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) onFile(f);
            }}
            style={drag ? { borderColor: 'var(--color-primary)', background: 'var(--color-primary-soft)' } : undefined}
        >
            <input
                ref={ref}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                }}
            />
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{fileName ?? label}</div>
                    {sub && <div className="text-xs text-[color:var(--color-muted)] mt-0.5">{sub}</div>}
                </div>
                <button
                    type="button"
                    className="cm-btn cm-btn--ghost cm-btn--sm"
                    onClick={(e) => {
                        e.preventDefault();
                        ref.current?.click();
                    }}
                >
                    {hasFile ? 'Replace' : 'Browse'}
                </button>
            </div>
        </label>
    );
}

export function Chip({
    children,
    active,
    onClick
}: {
    children: React.ReactNode;
    active?: boolean;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            className={`cm-chip ${active ? 'cm-chip--active' : ''}`}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

export function Stack({
    children,
    gap = 3,
    className = ''
}: {
    children: React.ReactNode;
    gap?: number;
    className?: string;
}) {
    return <div className={`flex flex-col gap-${gap} ${className}`}>{children}</div>;
}

export function Hairline({ className = '' }: { className?: string }) {
    return <div className={`cm-hairline ${className}`} />;
}

export function Swatch({
    color,
    active,
    onClick,
    title
}: {
    color: string;
    active?: boolean;
    onClick?: () => void;
    title?: string;
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className="relative rounded-md"
            style={{
                width: 28,
                height: 28,
                background: color,
                border: `2px solid ${active ? 'var(--color-ink)' : 'var(--color-hairline-strong)'}`,
                cursor: 'pointer'
            }}
        />
    );
}
