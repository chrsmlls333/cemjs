
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

export const processSVG = () => {
    removeBackgroundSVG();

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
    if (allCommandChars.some(c => "MLHV".indexOf(c) == -1 ))
        throw new Error(`I am not samrt enough to understand some of these codes: "${allCommandChars.join(',')}"`)
    
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

    console.log(pathElt.getAttribute('d'))
    pathElt.setAttribute('d', dString);
    console.log(pathElt.getAttribute('d'))
    return dString;
}

