# Packing builder

`pack-atlases.ts` valida asignaciones completas de grupos a atlas y crea planes deterministas
de empaquetado por filas con múltiples páginas. Los sprites conectados por animaciones forman
unidades indivisibles para que todos sus frames permanezcan en la misma página. No lee ni escribe
píxeles.

El workflow de build vive en `application/services/build-assets.ts`: genera el plan, decodifica las
fuentes por el puerto `AssetImporter` y delega el render de las páginas en un `AssetBuilder`. La
publicación de los artefactos es responsabilidad del host.
