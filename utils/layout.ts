import { DesignItem, PackedDesign } from '../types';

/**
 * Packs designs using an advanced Skyline algorithm optimized for minimum length.
 * For each item, it dynamically tries both orientations and chooses the one
 * that results in the lowest possible top edge (Y + Height).
 */
export const packDesigns = (
  items: DesignItem[],
  sheetWidth: number,
  spacing: number = 0
): { packed: PackedDesign[]; totalLength: number; totalAreaUsed: number } => {
  if (items.length === 0) return { packed: [], totalLength: 0, totalAreaUsed: 0 };

  const individualUnits: Omit<PackedDesign, 'x' | 'y' | 'rotated'>[] = [];
  items.forEach(item => {
    // If neither side fits the sheet, we skip it
    if (item.width > sheetWidth && item.height > sheetWidth) return;

    for (let i = 0; i < item.quantity; i++) {
      individualUnits.push({
        ...item,
        id: `${item.id}-${i}`,
        originalId: item.id,
      });
    }
  });

  // Sorting by the largest dimension helps in creating a more stable base for the packing
  individualUnits.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));

  let skyline = [{ x: 0, y: 0, width: sheetWidth }];
  const packed: PackedDesign[] = [];
  let totalAreaUsed = 0;

  individualUnits.forEach(unit => {
    const orientations = [
      { w: unit.width, h: unit.height, rotated: false },
      { w: unit.height, h: unit.width, rotated: true },
    ].filter(o => o.w <= sheetWidth);

    let bestChoice: { x: number, y: number, w: number, h: number, rotated: boolean, skylineIndex: number } | null = null;
    let minTopEdge = Infinity;

    // Evaluate both orientations to find which one results in the smallest local length increase
    orientations.forEach(orient => {
      const w = orient.w;
      const h = orient.h;

      for (let i = 0; i < skyline.length; i++) {
        let currentWidth = 0;
        let maxYInRange = 0;
        let possible = false;

        for (let j = i; j < skyline.length; j++) {
          currentWidth += skyline[j].width;
          maxYInRange = Math.max(maxYInRange, skyline[j].y);
          if (currentWidth >= w - 0.0001) {
            possible = true;
            break;
          }
        }

        if (possible) {
          const topEdge = maxYInRange + h;
          // Priority 1: Lowest top edge. Priority 2: Lowest X (to stay left)
          if (topEdge < minTopEdge - 0.0001 || (Math.abs(topEdge - minTopEdge) < 0.0001 && skyline[i].x < (bestChoice?.x ?? Infinity))) {
            minTopEdge = topEdge;
            bestChoice = { 
              x: skyline[i].x, 
              y: maxYInRange, 
              w: w, 
              h: h, 
              rotated: orient.rotated, 
              skylineIndex: i 
            };
          }
        }
      }
    });

    if (bestChoice) {
      const { x, y, w, h, rotated, skylineIndex } = bestChoice;
      
      packed.push({
        ...unit,
        x,
        y,
        width: w,
        height: h,
        rotated,
      });
      
      totalAreaUsed += w * h;

      // Update skyline
      const widthToOccupy = Math.min(w + spacing, sheetWidth - x);
      const newHeight = y + h + spacing;

      const newSegment = { x, y: newHeight, width: widthToOccupy };

      let consumedWidth = 0;
      let idx = skylineIndex;
      while (consumedWidth < widthToOccupy - 0.0001 && idx < skyline.length) {
        if (skyline[idx].width <= (widthToOccupy - consumedWidth) + 0.0001) {
          consumedWidth += skyline[idx].width;
          skyline.splice(idx, 1);
        } else {
          skyline[idx].x += (widthToOccupy - consumedWidth);
          skyline[idx].width -= (widthToOccupy - consumedWidth);
          consumedWidth = widthToOccupy;
        }
      }
      
      skyline.splice(skylineIndex, 0, newSegment);

      // Merge redundant segments
      for (let k = 0; k < skyline.length - 1; k++) {
        if (Math.abs(skyline[k].y - skyline[k+1].y) < 0.0001) {
          skyline[k].width += skyline[k+1].width;
          skyline.splice(k+1, 1);
          k--;
        }
      }
    }
  });

  const totalLength = packed.length > 0 ? Math.max(...packed.map(p => p.y + p.height)) : 0;

  return { packed, totalLength, totalAreaUsed };
};