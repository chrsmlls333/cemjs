import { canvasVectorSet, cyrusBeck } from "../math/lineClipping";
import { Vec, VecEquals } from "../math/vectormath";

const typecheckSVGCanvasElement = (svgGraphics: p5.Graphics) => {
    let elt: p5.Element = svgGraphics.elt; //actually a SVGCanvasElement
    if (!elt || !(elt as any).svg || (elt as any).svg.localName != 'svg') 
        throw new TypeError('What did you feed me??')
    return elt;
}

export const removeBackgroundSVG = (pInst: p5, c: p5.Graphics) => {
    const elt = typecheckSVGCanvasElement(c);
    const svg: SVGElement = (elt as any).svg;
    const query = svg.querySelectorAll(':scope > g > rect:first-child');
    if (!query.length) { 
        console.log("No background rect found to remove!"); 
        return;
    }
    const bg = query[0];
    if (Number.parseInt(bg.getAttribute('width') || "")  == c.width && 
        Number.parseInt(bg.getAttribute('height') || "") == c.height) {
        bg.remove();
        console.log("Background rect removed from SVG element...");
    }
}

const typecheckPathElement = (el: SVGPathElement) => {
    // if (el instanceof p5.Element) el = el.elt;
    if (!(el instanceof SVGPathElement && el.localName == 'path'))
        throw new TypeError('What did you feed me??')
    return el;
}

export const getLinePathXY = (pathElt: SVGPathElement) => {
    pathElt = typecheckPathElement(pathElt);

    const pathData = pathElt.getAttribute('d');
    if (!pathData) return [];
    let commTokens = pathData.split(/(?=[mlhvcsqtaz])/i).map(s => s.trim()).filter(Boolean);
    const re = new RegExp(/(?<command>[A-Z]) *(?<x>-?[0-9.]+)[ ,]+(?<y>-?[0-9.]+)/);
    let commands: { command: string, x: number, y: number }[] = [];
    commTokens.forEach(s => {
        let g = re.exec(s)?.groups;
        if (!g) return
        else commands.push({
            command: g.command,
            x: parseFloat(g.x),
            y: parseFloat(g.y)
        })
    })

    //Throw if unsupported commands are found!
    let allCommandChars = commands.map(c => c.command);
    if (allCommandChars.some(c => "MLHV".indexOf(c) == -1 )) {
        throw new Error(`I am not samrt enough to understand some of these codes: "${allCommandChars.join(',')}"`)
    }
    //Get some vectors for our trouble
    let points = commands.map(c => {
        switch (c.command) {
            case 'M':
                return Vec(c.x,c.y);
            case 'L':
                return Vec(c.x,c.y);
            case 'H':
                return Vec(c.x,0);
            case 'V':
                return Vec(0,c.x);
            default:
                console.warn('I found something worrying:', c);
                return Vec(0,0);
        }
    });
    return points;
}

export const setLinePathXY = (pathElt: SVGPathElement, vectors: Vec[], closed = false) => {
    pathElt = typecheckPathElement(pathElt);

    let encodedTokens = vectors.map((v, i) => {
        return ` ${i == 0 ? 'M' : 'L'} ${v.x.toPrecision(8)} ${v.y.toPrecision(8)}`;
    })
    let dString = encodedTokens.join('');
    dString = closed ? dString + ' Z' : dString;

    pathElt.setAttribute('d', dString);
    return dString;
}

export const cropPath = (pathElt: SVGPathElement, canvasBounds: Vec[]) => {
    pathElt = typecheckPathElement(pathElt);
    
    let linePoints = getLinePathXY(pathElt);
    let linePointsCrop = cyrusBeck(linePoints, canvasBounds); //defaults to canvas size
    // if (linePointsCrop != null) {
    //     console.log(`old: (${linePoints[0].x}, ${linePoints[0].y}) (${linePoints[1].x}, ${linePoints[1].y})`);
    //     console.log(`new: (${linePointsCrop[0].x}, ${linePointsCrop[0].y}) (${linePointsCrop[1].x}, ${linePointsCrop[1].y})`);}

    if (linePointsCrop == null ||                           //if outside of the canvas
        VecEquals(linePointsCrop[0], linePointsCrop[1])) {  //if cropped to a single point on the edge
        pathElt.remove();
        return -1;
    }
    else {
        setLinePathXY(pathElt, linePointsCrop);

        if (VecEquals(linePoints[0], linePointsCrop[0]) &&
            VecEquals(linePoints[1], linePointsCrop[1])) return 0

        return 1;
    }
}

export const cropAllPaths = (pInst: p5, c: p5.Graphics) => {
    const elt = typecheckSVGCanvasElement(c);
    const svg: SVGElement = (elt as any).svg;

    const canvasBounds = canvasVectorSet(c.width, c.height)

    let paths = svg.querySelectorAll('path');
    let originalTotal = paths.length;
    let deleted = 0;
    let altered = 0;
    paths.forEach((path, i) => {
      let result = cropPath(path, canvasBounds);    
      if (result == -1) deleted++;
      if (result ==  1) altered++;
    });
    console.log(`Paths cropped to canvas: 
    ${originalTotal} to process... 
    ${deleted} discarded...
    ${altered} cropped...
    ${originalTotal-deleted} exported...`);
}

export const processSVG = (pInst: p5, c: p5.Graphics) => {
    removeBackgroundSVG(pInst, c);
    cropAllPaths(pInst, c);
}