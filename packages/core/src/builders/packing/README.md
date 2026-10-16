# Packing builder

`pack-atlases.ts` valida asignaciones completas de grupos a atlas y crea planes deterministas
de empaquetado por filas con múltiples páginas. Los sprites conectados por animaciones forman
unidades indivisibles para que todos sus frames permanezcan en la misma página. No lee ni escribe
píxeles; las aplicaciones renderizan y publican las páginas resultantes.
