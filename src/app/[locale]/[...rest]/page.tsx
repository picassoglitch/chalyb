import { notFound } from 'next/navigation';

// Any path no route matches lands here, so it gets the branded, translated
// not-found page of [locale] instead of Next's bare English "404: This page
// could not be found." with no way back to the site.
export default function CatchAll() {
  notFound();
}
