'use client';

import type {ButtonHTMLAttributes, ReactNode} from 'react';
import {useFormStatus} from 'react-dom';

export function LoadingSpinner({className = ''}: {className?: string}) {
  return <span aria-hidden="true" className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

type PendingSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: ReactNode;
};

export function PendingSubmitButton({children, disabled, pendingLabel, ...props}: PendingSubmitButtonProps) {
  const {pending} = useFormStatus();

  return (
    <button {...props} aria-busy={pending} disabled={disabled || pending} type="submit">
      <span className="inline-flex items-center gap-2">
        {pending ? <LoadingSpinner /> : null}
        {pending && pendingLabel ? pendingLabel : children}
      </span>
    </button>
  );
}
