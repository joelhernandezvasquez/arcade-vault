-- Spec 10: Snake real en la entrada 'serpentina'.
-- Solo cambian short/long (el texto anterior hablaba de "núcleos magenta");
-- id, title, cat, cover, color, best, plays y sort_order se conservan.
update games
set
  short = 'Come frutas, crece y no te muerdas la cola.',
  long  = 'Una serpiente recorre la grilla en busca de frutas. Cada bocado la alarga y, cada cinco, la hace más veloz. Choca contra el borde o contra tu propio cuerpo y la partida termina.'
where id = 'serpentina';
