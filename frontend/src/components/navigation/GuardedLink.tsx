import { forwardRef } from 'react';
import type { MouseEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { LinkProps, NavLinkProps } from 'react-router-dom';
import { useNavigationGuard } from '../../hooks/navigationGuard';

function ordinaryClick(event: MouseEvent<HTMLAnchorElement>, target?: string) {
    return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey && (!target || target === '_self');
}
export const GuardedLink = forwardRef<HTMLAnchorElement, LinkProps>(function GuardedLink({ to, state, replace, relative, preventScrollReset, onClick, target, reloadDocument, ...props }, ref) {
    const navigate = useNavigate(); const guard = useNavigationGuard();
    return <Link {...props} ref={ref} to={to} state={state} replace={replace} relative={relative} target={target} reloadDocument={reloadDocument} preventScrollReset={preventScrollReset} onClick={event => {
        onClick?.(event);
        if (!reloadDocument && ordinaryClick(event, target)) { event.preventDefault(); guard.request(() => navigate(to, { state, replace, relative, preventScrollReset })); }
    }} />;
});
export const GuardedNavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function GuardedNavLink({ to, state, replace, relative, preventScrollReset, onClick, target, reloadDocument, ...props }, ref) {
    const navigate = useNavigate(); const guard = useNavigationGuard();
    return <NavLink {...props} ref={ref} to={to} state={state} replace={replace} relative={relative} target={target} reloadDocument={reloadDocument} preventScrollReset={preventScrollReset} onClick={event => {
        onClick?.(event);
        if (!reloadDocument && ordinaryClick(event, target)) { event.preventDefault(); guard.request(() => navigate(to, { state, replace, relative, preventScrollReset })); }
    }} />;
});
