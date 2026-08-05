import { redirect } from 'next/navigation';

/**
 * Markets management is handled within the main admin panel (/admin).
 * This redirect ensures the sidebar nav link works correctly.
 */
export default function AdminMarketsPage() {
  redirect('/admin?section=markets');
}
