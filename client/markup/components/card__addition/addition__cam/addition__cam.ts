// ОГРОМНОЕ TODO: переписать этот файл вообще - код гавнище полное

// Расстояния между первым косанием и движением
const getDiffXY = (startX : number, startY : number, x : number, y : number) => {
    const dx = x - startX;
    const dy = y - startY;
    return {dx, dy};
};

// Для того что бы достать значение яркости из css фильтра
const safeParseInt = (val : any) => {
    return parseInt(isNaN(val) ? val.replace(/[^-\d]\.+/g, '') : val, 10);
};

// ВОПРОС ПЯТЬ ТЫСЯЧ - в ТЗ ДЗ написано что примещуством будет отсутсиве any
// Но мне внатуре нужен any, ЖИЗНЕННО НЕОБХОДИМ
// вопрос - как тут мне обойтись без any и что бы было все красиво?
// ах да, еще чо за бред что isNaN принимает только number?

// Для того что бы достать значение яркости из css фильтра
const safeParseFloat = (val : any) => {
    return parseFloat(isNaN(val) ? val.replace(/[^\d\\.]+/g, '') : val);
};

// Округление до 2 знака
const roundFloat = (number : number) => {
    return Math.round(number * 100) / 100;
};

/**
 * Изменение css стиля элемента
 * @param value
 * @param styleKey
 * @param strBefore
 * @param strAfter
 * @param limitationMinMax - ограничения, limitationMinMax[0] - min, limitationMinMax[1] - max
 */
// ВОПРОС - как правильно писать параметры если они не влезают в одну строку?
const changeElemenStyle = (
                            el : HTMLElement, value : number, styleKey : string,
                            strBefore : string, strAfter : string, limitationMinMax? : number[]
                        ) => {
    if (styleKey === 'transform') {
        return;
    }

    //  >< в TS нету доступа к элементу массива по ключу c использованием переменной ???? bread
    const prevStyle = safeParseFloat(getComputedStyle(el).getPropertyValue(styleKey));
    let newStyle = prevStyle + value;
    // Ограничение на стилевые параметры
    if(limitationMinMax) {
        if (limitationMinMax.length === 2) {
            newStyle = newStyle < limitationMinMax[0] ? limitationMinMax[0] : newStyle;
            newStyle = newStyle > limitationMinMax[1] ? limitationMinMax[1] : newStyle;
        }
    }
    const propertyValue : string = strBefore + roundFloat(newStyle) + strAfter;
    el.style.setProperty(styleKey, propertyValue);
};

/** Получим transform: matrix в виде массива
 *  @param el - ДОМ узел у которого надо достать матрицу transform
 *  @return - matrix[index]
 */
const getTransformMatrix = (el : HTMLElement) => {
    let transform = [...getComputedStyle(el).getPropertyValue('transform').replace(/,/g, '')];
    let indexToDel = transform.indexOf(')');
    // delete ')'
    transform.splice(indexToDel, 1);
    // delete 'matrix('
    transform.splice(0, 7);
    let matrixArray = transform.join('').split(' ');
    return matrixArray;
};

/**
 * Изменение css свойства transform элемента
 * @param {DOMNode} el - ДОМ узел стиль которого надо изменить
 * @param {Array(6)} value - martix(...)
 * @param {Array(2)(6)} limitationMinMax - limitationMinMax[0][...] - min, limitationMinMax[1][...] - max,  , если элемент = NaN - ограничения нет
 * навреное как-то по другому надо было ограничение принимать
 */
const changeElementTransform = (el : HTMLElement, value : number[], limitationMinMax: number[][]) => {
    const matrix = getTransformMatrix(el);
    const newValue = matrix.map( (item, index) => {
        if ( isNaN( limitationMinMax[0][index] ) && isNaN( limitationMinMax[1][index] ) ) {
            return roundFloat( parseFloat( item ) + value[index] );
        } else if ( parseFloat( item ) + value[index] < limitationMinMax[0][index] ) {
            return roundFloat( limitationMinMax[0][index] );
        } else if ( parseFloat( item ) + value[index] > limitationMinMax[1][index] ) {
            return roundFloat( limitationMinMax[1][index] );
        } else {
            return roundFloat( parseFloat(item) + value[index] );
        }
    }).join(', ');
    el.style.transform = 'matrix(' + newValue + ')';
};

// интерфейс? струкутура? класс? что правильнее использовать?
interface ElementLimit {
    MaxWidth: number;
    MaxHeight: number;
    MinWidth: number;
    MinHeight: number;
    offsetX: number;
    offsetY: number;
}

interface State {
    startX: number,
    startY: number,
    clientX: number,
    clientY: number
}

enum Gesture {
    none = 'none',
    move = 'move',
    rotate = 'rotate',
    pinch = 'pinch'
}

class AdditionCam {
    currentState: State | null;
    evCache: PointerEvent[];
    prevDiff: number;
    prevAngle: number;
    el: HTMLDivElement | null;
    elLimit: ElementLimit;
    gesture: Gesture;

    constructor() {
        this.currentState = null; // Координаты x,y нажатия
        this.evCache = [];
        this.prevDiff = -1;
        this.prevAngle = -1;
        this.el = null;
        this.elLimit = {
            MaxWidth: 0,
            MinWidth: 0,
            MaxHeight: 0,
            MinHeight: 0,
            offsetX: 0,
            offsetY: 0
        };
        this.gesture = Gesture.none;
    }

    init(camContainer : HTMLDivElement, cam: HTMLDivElement) {
        // Да нет у меня паранои
        this.el = cam;

        // При ресайзе пользовательского окна надо будет обновлять эти параметры
        this.elLimit.MaxWidth = safeParseInt( getComputedStyle(this.el).width );
        this.elLimit.MaxHeight = safeParseInt( getComputedStyle(this.el).height );
        this.elLimit.MinWidth = safeParseInt( getComputedStyle(this.el).width );
        this.elLimit.MinHeight = safeParseInt( getComputedStyle(this.el).height );
        this.elLimit.offsetX = safeParseInt( getComputedStyle(camContainer).width );
        this.elLimit.offsetY = safeParseInt( getComputedStyle(camContainer).height );

        cam.addEventListener('pointerdown', this.pointerdownHandler.bind(this));
        cam.addEventListener('pointermove', this.pointermoveHandler.bind(this));
        cam.addEventListener('pointerup', this.pointerupHandler.bind(this));
        cam.addEventListener('pointercancel', this.pointerupHandler.bind(this));
        cam.addEventListener('pointerout', this.pointerupHandler.bind(this));
        cam.addEventListener('pointerleave', this.pointerupHandler.bind(this));
    }

    // Получение координат события
    setState(ev : PointerEvent) {
        this.currentState = {
            startX: ev.x,
            startY: ev.y,
            clientX: ev.clientX,
            clientY: ev.clientY
        };
    }
    
    // Pointer event
    pointerdownHandler(ev : PointerEvent) {
        // Инициализируем состояние нажатия
        this.setState(ev);
        this.evCache.push(ev);
        // Да чо за бред и как от него избавиться? если я вызываваю pointerdownHandler только в init, где инициализирую el ???
        if(this.el) {
            this.el.setPointerCapture(ev.pointerId);
        }
    }

    pointermoveHandler(ev : PointerEvent) {
        if (!this.currentState) {
            return;
        }

        let cWidth : number = 0;
        let cHeight : number = 0;

        // ну чо за костыль
        if (ev.target instanceof Element) {
            cWidth =  ev.target.clientWidth;
            cHeight = ev.target.clientHeight;
        }

    
        if (this.evCache.length === 1) {
            this.procGestureMove(ev.clientX, ev.clientY, cWidth, cHeight);
        }
    
        // Find this event in the cache and update its record with this event
        for (let i = 0; i < this.evCache.length; i++) {
            if (ev.pointerId === this.evCache[i].pointerId) {
                this.evCache[i] = ev;
                break;
            }
            // If two pointers are down, check for pinch gestures or rotate
            if (this.evCache.length === 2) {
                // Calculate the distance and angle between the two pointers
                const curDiffX = Math.abs(this.evCache[0].clientX - this.evCache[1].clientX);
                const curDiffY = Math.abs(this.evCache[0].clientY - this.evCache[1].clientY);
                const curDiff = Math.sqrt(Math.pow(curDiffX, 2) + Math.pow(curDiffY, 2));
                const curAngle = Math.atan2(curDiffY, curDiffX) * 180 / Math.PI;

                // Если пальцы уже двигались
                if (this.prevDiff > 0 && this.prevAngle > 0) {
                    const rotate = Math.abs( this.prevDiff - curDiff ) < 15;
                    const PINCH_THRESHHOLD = Math.sqrt(Math.pow(cWidth, 2) + Math.pow(cHeight, 2)) / 20;
                    const pinch = curDiff / 2 >= PINCH_THRESHHOLD;

                    if (this.gesture === null) {
                        if (rotate) {
                            this.gesture = Gesture.rotate;
                        } else if (pinch) {
                            this.gesture = Gesture.pinch;
                        }
                    }

                    if (rotate && this.gesture === 'rotate') {
                        this.procGestureRotate(curAngle, ev.clientX, ev.clientY);    
                    } else if (pinch && this.gesture === 'pinch') {
                        this.procGesturePinch(curDiff, cWidth, cHeight);
                    }
                }
                // Cache the distance for the next move event
                this.prevDiff = curDiff;
                this.prevAngle = curAngle;
                this.setState(ev);
            }
        }
    }
    
    pointerupHandler(ev : PointerEvent) {
        // If the number of pointers down is less than two then reset diff tracker
        if (this.evCache.length < 2) {
            this.prevDiff = -1;
            this.prevAngle = -1;
            this.gesture = Gesture.none;
        }
        this.removeEvent(ev);
        this.stopMove();
    }

    removeEvent(ev : PointerEvent) {
        // Remove this event from the target's cache
        for (let i = 0; i < this.evCache.length; i++) {
            if (this.evCache[i].pointerId === ev.pointerId) {
                this.evCache.splice(i, 1);
                break;
            }
        }
    }

    stopMove() {
        if (!this.currentState) {
            return;
        }
        this.currentState = null;
    }

    procGestureRotate(curAngle : number, clientX : number, clientY : number) {
        if(this.currentState && this.el) {
            const {dx, dy} = getDiffXY(this.currentState.startX, this.currentState.startY, clientX, clientY);
            const da = curAngle - this.prevAngle;
            let singAngl = 1;
            const firstQuarter = dx > 0 && dy > 0 && da < 0;
            const secondQuarter = dx < 0 && dy > 0 && da > 0;
            const thirdQuarter = dx < 0 && dy < 0 && da < 0;
            const fourthQuarter = dx > 0 && dy < 0 && da > 0;
            if ( firstQuarter || secondQuarter || thirdQuarter || fourthQuarter) {
                singAngl = 1;
            } else {
                singAngl = -1;
            }
        
            const coefficient = 0.01 * Math.abs(curAngle - this.prevAngle) * singAngl;
            changeElemenStyle(this.el, coefficient, 'filter', 'brightness(', ')', [0.01, 2]);
        }
    }

    procGestureMove(clientX : number, clientY : number, clientWidth : number, clientHeight : number) {
        if(this.currentState && this.el) {
            const {dx, dy} = getDiffXY(this.currentState.startX, this.currentState.startY, clientX, clientY);
            const coefficient = 0.1;

            const scale = Number(getTransformMatrix(this.el)[0]);
            const limits = this.elLimit;
            const limitX = clientWidth * scale - limits.offsetX;
            const limitY = clientHeight * scale - limits.offsetY;

            const martix = [0, 0, 0, 0, dx * coefficient, dy * coefficient];
            const limit = [
                [NaN, NaN, NaN, NaN, -1 * limitX, -1 * limitY],
                [NaN, NaN, NaN, NaN, 0, 0]
            ];
            changeElementTransform(this.el, martix, limit);
        }
    }

    procGesturePinch(curDiff : number, clientWidth : number, clientHeight : number) {
        if(this.el) {
            // Зум
            const signDiff = curDiff > this.prevDiff ? 1 : -1;

            const martix = [0.1 * signDiff, 0, 0, 0.1 * signDiff, 0, 0];
            const limit = [
                [0.6, NaN, NaN, 0.6, NaN, NaN],
                [2, NaN, NaN, 2, 0, 0]
            ];
            changeElementTransform(this.el, martix, limit);

            const scale = Number(getTransformMatrix(this.el)[0]);
            const limits = this.elLimit;
            const limitX = clientWidth * scale - limits.offsetX;
            const limitY = clientHeight * scale - limits.offsetY;

            // Что бы при зумировании не происходило сдвига
            const martixClr = [0, 0, 0, 0, 0, 0];
            const limitClr = [
                [NaN, NaN, NaN, NaN, -1 * limitX, -1 * limitY],
                [NaN, NaN, NaN, NaN, 0, 0]
            ];
            changeElementTransform(this.el, martixClr, limitClr);
        }
    }
}


export default function () {
    // Лучше навернеое эспортить класс, а все что тут - на уровень выше передавать
    const camContainer : HTMLDivElement | null = document.querySelector('.addition__cam');
    const cam : HTMLDivElement | null = document.querySelector('.addition__cam .addition__cam__img');
    const zommValue : HTMLDivElement | null = document.querySelector('.addition__cam__zoom .addition__optional__value');
    const brightValue : HTMLDivElement | null = document.querySelector('.addition__cam__brightness .addition__optional__value');

    const additionCam = new AdditionCam();

    if (camContainer && cam) {
        additionCam.init(camContainer, cam);

        // Отслеживаие изменения стилей css
        const mutationObserver = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    let str : string = '';
                    if(additionCam.el) {
                        str = ( Number(getTransformMatrix(additionCam.el)[0]) * 100 ).toFixed(0);

                        if(zommValue) {
                            zommValue.textContent = str + ' %';
                        } else {
                            // TODO: еще ошибку
                        }
        
                        let value = safeParseFloat( getComputedStyle(additionCam.el).filter );
                        if(brightValue) {
                            brightValue.textContent = (value * 100).toFixed(0) + ' %';
                        } else {
                            // TODO: еще ошибку, больше ошибок
                        }
                    }
                }
            });
        });
    
        const mutationConfig = { attributes: true };
        if(cam) {
            mutationObserver.observe(cam, mutationConfig);
        } else {
            // TODO: еще одну ошибку
        }
    } else {
        // TODO: ОШИБКУ ЛАОЩФЫДЛЬАФЫЩШОПМЩШЦУРПЩШЗ
    }
   
}
