import { cyrusBeck } from "../math/lineClipping.js";
import { VecEquals } from "../math/vectormath.js";

const typecheckSVGCanvasElement = e => {
    if (e instanceof p5.RendererSVG) e = e.elt;
    if (e instanceof p5.Graphics) e = e.elt;
    if (!e.svg || e.svg.localName != 'svg')
        throw new TypeError('What did you feed me??')
    return e;
}

export const removeBackgroundSVG = (c) => {
    const { svg } = typecheckSVGCanvasElement(c);
    const query = svg.querySelectorAll(':scope > g > rect:first-child');
    if (!query.length) { 
        console.log("No background rect found to remove!"); 
        return;
    }
    const bg = query[0];
    if (Number.parseInt(bg.getAttribute('width'))  == c.width && 
        Number.parseInt(bg.getAttribute('height')) == c.height) {
        bg.remove();
        console.log("Background rect removed from SVG element...");
    }
}

const typecheckPathElement = e => {
    if (e instanceof p5.Element) e = e.elt;
    if (!(e instanceof Element && e.localName == 'path'))
        throw new TypeError('What did you feed me??')
    return e;
}

export const getLinePathXY = (pathElt) => {
    pathElt = typecheckPathElement(pathElt);

    const pathData = pathElt.getAttribute('d');
    let commTokens = pathData.split(/(?=[mlhvcsqtaz])/i).map(s => s.trim()).filter(Boolean);
    const re = new RegExp(/(?<command>[A-Z]) *(?<x>-?[0-9.]+)[ ,]+(?<y>-?[0-9.]+)/);
    let commands = commTokens.map( s => {
        let g = re.exec(s).groups;
        g.x = parseFloat(g.x);
        g.y = parseFloat(g.y);
        return g;
    } );

    //Throw if unsupported commands are found!
    let allCommandChars = commands.map(v => v.command);
    if (allCommandChars.some(c => "MLHV".indexOf(c) == -1 )) {
        throw new Error(`I am not samrt enough to understand some of these codes: "${allCommandChars.join(',')}"`)
    }
    //Get some vectors for our trouble
    let points = commands.map(c => {
        switch (c.command) {
            case 'M':
            case 'L':
                return createVector(c.x,c.y);
            case 'H':
                return createVector(c.x,0);
            case 'H':
                return createVector(0,c.x);
            default:
                console.warn('I found something worrying:', c);
                return createVector(0,0);
        }
    });

    return points;
}

export const setLinePathXY = (pathElt, vectors, closed = false) => {
    pathElt = typecheckPathElement(pathElt);

    let encodedTokens = vectors.map((v, i) => {
        return ` ${i == 0 ? 'M' : 'L'} ${v.x.toPrecision(8)} ${v.y.toPrecision(8)}`;
    })
    let dString = encodedTokens.join('');
    dString = closed ? dString + ' Z' : dString;

    pathElt.setAttribute('d', dString);
    return dString;
}

export const cropPath = (pathElt) => {
    pathElt = typecheckPathElement(pathElt);
    
    let linePoints = getLinePathXY(pathElt);
    let linePointsCrop = cyrusBeck(linePoints); //defaults to canvas size
    // if (linePointsCrop != null) {
    //     console.log(`old: (${linePoints[0].x}, ${linePoints[0].y}) (${linePoints[1].x}, ${linePoints[1].y})`);
    //     console.log(`new: (${linePointsCrop[0].x}, ${linePointsCrop[0].y}) (${linePointsCrop[1].x}, ${linePointsCrop[1].y})`);}

    if (linePointsCrop == null ||                           //if outside of the canvas
        VecEquals(linePointsCrop[0], linePointsCrop[1])) {  //if cropped to a single point on the edge
        pathElt.remove();
        return -1;
    }
    else {
        setLinePathXY(pathElt, linePointsCrop) 

        if (VecEquals(linePoints[0], linePointsCrop[0]) &
            VecEquals(linePoints[1], linePointsCrop[1])) return 0

        return 1;
    }
}

export const cropAllPaths = (c = canvas) => {
    const { svg } = typecheckSVGCanvasElement(c);
    let paths = svg.querySelectorAll('path');
    let originalTotal = paths.length;
    let deleted = 0;
    let altered = 0;
    paths.forEach((path, i) => {
      let result = cropPath(path);    
      if (result == -1) deleted++;
      if (result ==  1) altered++;
    });
    console.log(`Paths cropped to canvas: 
    ${originalTotal} to process... 
    ${deleted} discarded...
    ${altered} cropped...
    ${originalTotal-deleted} exported...`);
}

export const processSVG = (c = canvas) => {
    removeBackgroundSVG(c);
    cropAllPaths(c);
}