-- Spec Frogger: juego real en la entrada 'ranaria'.
-- Solo cambian short/long; id, title, cat, cover, color, best, plays y
-- sort_order se conservan.
update games
set
  short = 'Cruza la carretera y el río sin convertirte en papilla.',
  long  = 'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.'
where id = 'ranaria';
