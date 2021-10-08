import { cyrusBeck } from "./math/lineClipping.js";

export const SVGmode = () => {
    return !!canvas.svg;
}

export const removeBackgroundSVG = () => {
    if (!SVGmode()) throw new TypeError("p5 canvas is not an SVG!");
    const query = querySVG(':scope > g > rect:first-child');
    if (query.length == 0) { 
        console.log("No background rect found to remove!"); 
        return;
    }
    const bg = query[0];
    if (Number.parseInt(bg.attribute('width')) == width && 
        Number.parseInt(bg.attribute('height')) == height) {
        bg.elt.remove();
        console.log("Background rect removed from SVG element...");
    }
}

export const getLinePathXY = (pathElt) => {
    if (pathElt instanceof p5.Element) pathElt = pathElt.elt;
    if (!(pathElt instanceof Element && pathElt.localName == 'path'))
        throw new TypeError('What did you feed me??')

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
    if (pathElt instanceof p5.Element) pathElt = pathElt.elt;
    if (!(pathElt instanceof Element && pathElt.localName == 'path'))
        throw new TypeError('What did you feed me??')

    let encodedTokens = vectors.map((v, i) => {
        return ` ${i == 0 ? 'M' : 'L'} ${v.x.toPrecision(8)} ${v.y.toPrecision(8)}`;
    })
    let dString = encodedTokens.join('');
    dString = closed ? dString + ' Z' : dString;

    pathElt.setAttribute('d', dString);
    return dString;
}

export const cropPath = (pathElt) => {
    if (pathElt instanceof p5.Element) pathElt = pathElt.elt;
    if (!(pathElt instanceof Element && pathElt.localName == 'path'))
        throw new TypeError('What did you feed me??');
    
    let linePoints = getLinePathXY(pathElt);
    let linePointsCrop = cyrusBeck(linePoints); //defaults to canvas size
    // if (linePointsCrop != null) {
    //     console.log(`old: (${linePoints[0].x}, ${linePoints[0].y}) (${linePoints[1].x}, ${linePoints[1].y})`);
    //     console.log(`new: (${linePointsCrop[0].x}, ${linePointsCrop[0].y}) (${linePointsCrop[1].x}, ${linePointsCrop[1].y})`);}

    if (linePointsCrop == null ||                       //if outside of the canvas
        linePointsCrop[0].equals(linePointsCrop[1])) {  //if cropped to a single point on the edge
        pathElt.remove();
        return -1;
    }
    else {
        setLinePathXY(pathElt, linePointsCrop) 

        if (linePoints[0].equals(linePointsCrop[0]) &
            linePoints[1].equals(linePointsCrop[1])) return 0

        return 1;
    }
}

export const cropAllPaths = () => {
    let paths = querySVG('path');
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
    ${altered} cropped...
    ${deleted} discarded...
    ${originalTotal-deleted} exported...`);
}

export const processSVG = () => {
    removeBackgroundSVG();
    cropAllPaths();
}