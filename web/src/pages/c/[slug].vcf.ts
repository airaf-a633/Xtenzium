import type { APIRoute, GetStaticPaths } from 'astro';
import { cards, vcard, type Card } from '../../data/cards';

export const getStaticPaths: GetStaticPaths = () =>
  cards.map((card) => ({ params: { slug: card.slug }, props: { card } }));

export const GET: APIRoute = ({ props }) =>
  new Response(vcard((props as { card: Card }).card), {
    headers: { 'Content-Type': 'text/vcard; charset=utf-8' },
  });
