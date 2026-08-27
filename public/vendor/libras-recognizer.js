/*
 * JOVI — reconhecedor do alfabeto manual de Libras (A-Z + Ç)
 *
 * O MediaPipe fornece somente os 21 pontos da mão. Este módulo transforma
 * esses pontos em coordenadas anatômicas, reconhece configurações de mão e
 * analisa trajetórias para as letras que possuem movimento.
 *
 * A calibração opcional salva exemplos da mão do próprio usuário no navegador.
 * Ela é especialmente útil para configurações visualmente próximas, como
 * A/E/S, M/N, D/G e F/T.
 */
(function exposeLibrasRecognizer(global) {
    'use strict';

    const STATIC_LETTERS = [
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I',
        'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
        'T', 'U', 'V', 'W', 'Y'
    ];
    const DYNAMIC_LETTERS = ['Ç', 'J', 'Z'];
    const STORAGE_VERSION = 5;
    const NEURAL_STORAGE_VERSION = 1;

    const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
    const point = (p) => ({ x: p.x, y: p.y, z: Number.isFinite(p.z) ? p.z : 0 });
    const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
    const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const magnitude = (v) => Math.hypot(v.x, v.y, v.z);
    const normalize = (v) => {
        const length = magnitude(v);
        return length > 1e-8
            ? { x: v.x / length, y: v.y / length, z: v.z / length }
            : { x: 0, y: 0, z: 0 };
    };
    const cross = (a, b) => ({
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    });
    const distance = (a, b) => magnitude(subtract(a, b));

    function angleAt(a, b, c) {
        const first = subtract(a, b);
        const second = subtract(c, b);
        const denominator = magnitude(first) * magnitude(second);
        if (denominator < 1e-8) return 0;
        const cosine = clamp(dot(first, second) / denominator, -1, 1);
        return Math.acos(cosine) * 180 / Math.PI;
    }

    function average(values) {
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    }

    function rmsDistance(first, second) {
        if (!first || !second || first.length !== second.length || !first.length) return Infinity;
        let sum = 0;
        for (let index = 0; index < first.length; index += 1) {
            const delta = first[index] - second[index];
            sum += delta * delta;
        }
        return Math.sqrt(sum / first.length);
    }

    function percentile(values, ratio) {
        if (!values.length) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
    }

    function meanVector(vectors) {
        if (!vectors.length) return [];
        const result = new Array(vectors[0].length).fill(0);
        vectors.forEach((vector) => {
            vector.forEach((value, index) => { result[index] += value; });
        });
        return result.map((value) => value / vectors.length);
    }

    function seededRandom(seed = 123456789) {
        let state = seed >>> 0;
        return () => {
            state += 0x6D2B79F5;
            let value = state;
            value = Math.imul(value ^ (value >>> 15), value | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
    }

    function softmax(logits) {
        const maximum = Math.max(...logits);
        const exponentials = logits.map((value) => Math.exp(value - maximum));
        const total = exponentials.reduce((sum, value) => sum + value, 0) || 1;
        return exponentials.map((value) => value / total);
    }

    /**
     * Rede pequena para personalização no dispositivo.
     *
     * A MLP aprende somente exemplos explicitamente rotulados pelo usuário. As
     * regras genéricas continuam disponíveis para letras ainda não treinadas e
     * um teste de distância rejeita mãos que não se parecem com o conjunto de
     * treinamento. Isso evita que uma rede treinada apenas com F/H chame todas
     * as outras configurações de F ou H.
     */
    class PersonalLibrasNeuralNetwork {
        constructor(storageKey) {
            this.storageKey = storageKey;
            this.model = this.load();
            this.training = false;
        }

        load() {
            try {
                const stored = global.localStorage && global.localStorage.getItem(this.storageKey);
                if (!stored) return null;
                const model = JSON.parse(stored);
                const valid = model.version === NEURAL_STORAGE_VERSION
                    && Array.isArray(model.classes) && model.classes.length >= 2
                    && model.classes.every((letter) => STATIC_LETTERS.includes(letter))
                    && Number.isInteger(model.inputSize) && Number.isInteger(model.hiddenSize)
                    && Array.isArray(model.mean) && model.mean.length === model.inputSize
                    && Array.isArray(model.std) && model.std.length === model.inputSize
                    && Array.isArray(model.w1) && model.w1.length === model.inputSize * model.hiddenSize
                    && Array.isArray(model.b1) && model.b1.length === model.hiddenSize
                    && Array.isArray(model.w2) && model.w2.length === model.hiddenSize * model.classes.length
                    && Array.isArray(model.b2) && model.b2.length === model.classes.length;
                return valid ? model : null;
            } catch (error) {
                console.warn('Não foi possível carregar a rede neural pessoal:', error);
                return null;
            }
        }

        save() {
            try {
                if (global.localStorage && this.model) {
                    global.localStorage.setItem(this.storageKey, JSON.stringify(this.model));
                }
            } catch (error) {
                console.warn('Não foi possível salvar a rede neural pessoal:', error);
            }
        }

        clear() {
            this.model = null;
            try {
                if (global.localStorage) global.localStorage.removeItem(this.storageKey);
            } catch (_) {
                // A rede continua limpa em memória mesmo se o armazenamento falhar.
            }
        }

        getStatus() {
            return {
                ready: Boolean(this.model),
                training: this.training,
                classes: this.model ? [...this.model.classes] : [],
                validationAccuracy: this.model ? this.model.validationAccuracy : 0,
                epochs: this.model ? this.model.epochs : 0,
                trainedAt: this.model ? this.model.trainedAt : null
            };
        }

        normalizeFeature(feature, model) {
            return feature.map((value, index) => clamp(
                (value - model.mean[index]) / model.std[index],
                -6,
                6
            ));
        }

        forward(feature, model) {
            const hidden = new Array(model.hiddenSize).fill(0);
            for (let hiddenIndex = 0; hiddenIndex < model.hiddenSize; hiddenIndex += 1) {
                let value = model.b1[hiddenIndex];
                const offset = hiddenIndex * model.inputSize;
                for (let inputIndex = 0; inputIndex < model.inputSize; inputIndex += 1) {
                    value += model.w1[offset + inputIndex] * feature[inputIndex];
                }
                hidden[hiddenIndex] = Math.max(0, value);
            }

            const logits = new Array(model.classes.length).fill(0);
            for (let classIndex = 0; classIndex < model.classes.length; classIndex += 1) {
                let value = model.b2[classIndex];
                const offset = classIndex * model.hiddenSize;
                for (let hiddenIndex = 0; hiddenIndex < model.hiddenSize; hiddenIndex += 1) {
                    value += model.w2[offset + hiddenIndex] * hidden[hiddenIndex];
                }
                logits[classIndex] = value;
            }
            return { hidden, probabilities: softmax(logits) };
        }

        predict(feature) {
            const model = this.model;
            if (!model || !Array.isArray(feature) || feature.length !== model.inputSize) return null;
            const normalized = this.normalizeFeature(feature, model);
            const probabilities = this.forward(normalized, model).probabilities;
            const ranking = probabilities
                .map((probability, index) => ({ probability, index }))
                .sort((first, second) => second.probability - first.probability);
            const first = ranking[0];
            const second = ranking[1] || { probability: 0 };
            return {
                letter: model.classes[first.index],
                probability: first.probability,
                margin: first.probability - second.probability,
                probabilities
            };
        }

        async train(samplesByLetter, minimumSamples, onProgress) {
            if (this.training) throw new Error('A rede neural já está em treinamento.');
            const classes = STATIC_LETTERS.filter((letter) => (
                Array.isArray(samplesByLetter[letter])
                && samplesByLetter[letter].length >= minimumSamples
            ));

            if (classes.length < 2) {
                this.clear();
                return { ...this.getStatus(), reason: 'minimum-classes' };
            }

            const inputSize = samplesByLetter[classes[0]][0].length;
            const rawTraining = [];
            const rawValidation = [];
            classes.forEach((letter, classIndex) => {
                const validSamples = samplesByLetter[letter]
                    .filter((sample) => Array.isArray(sample) && sample.length === inputSize)
                    .slice(-60);
                validSamples.forEach((feature, sampleIndex) => {
                    const item = { feature, label: classIndex };
                    if (sampleIndex % 5 === 0) rawValidation.push(item);
                    else rawTraining.push(item);
                });
            });

            if (!rawTraining.length || !rawValidation.length) {
                this.clear();
                return { ...this.getStatus(), reason: 'insufficient-samples' };
            }

            this.training = true;
            try {
                const mean = new Array(inputSize).fill(0);
                rawTraining.forEach(({ feature }) => feature.forEach((value, index) => {
                    mean[index] += value;
                }));
                mean.forEach((_, index) => { mean[index] /= rawTraining.length; });

                const std = new Array(inputSize).fill(0);
                rawTraining.forEach(({ feature }) => feature.forEach((value, index) => {
                    const delta = value - mean[index];
                    std[index] += delta * delta;
                }));
                std.forEach((_, index) => {
                    std[index] = Math.max(0.035, Math.sqrt(std[index] / rawTraining.length));
                });

                const hiddenSize = Math.max(32, Math.min(56, Math.round(inputSize * 0.58)));
                const random = seededRandom(classes.join('').split('').reduce(
                    (seed, character) => seed * 31 + character.charCodeAt(0),
                    2166136261
                ));
                const randomWeight = (scale) => (random() * 2 - 1) * scale;
                const model = {
                    version: NEURAL_STORAGE_VERSION,
                    classes,
                    inputSize,
                    hiddenSize,
                    mean,
                    std,
                    w1: Array.from(
                        { length: inputSize * hiddenSize },
                        () => randomWeight(Math.sqrt(6 / (inputSize + hiddenSize)))
                    ),
                    b1: new Array(hiddenSize).fill(0),
                    w2: Array.from(
                        { length: hiddenSize * classes.length },
                        () => randomWeight(Math.sqrt(6 / (hiddenSize + classes.length)))
                    ),
                    b2: new Array(classes.length).fill(0)
                };
                const normalizedItem = (item) => ({
                    label: item.label,
                    feature: this.normalizeFeature(item.feature, model)
                });
                const training = rawTraining.map(normalizedItem);
                const validation = rawValidation.map(normalizedItem);

                const parameterNames = ['w1', 'b1', 'w2', 'b2'];
                const firstMoment = {};
                const secondMoment = {};
                parameterNames.forEach((name) => {
                    firstMoment[name] = new Array(model[name].length).fill(0);
                    secondMoment[name] = new Array(model[name].length).fill(0);
                });
                let updateStep = 0;
                let bestLoss = Infinity;
                let bestWeights = null;
                let bestAccuracy = 0;
                let staleEpochs = 0;
                let completedEpochs = 0;
                const maximumEpochs = 180;
                const batchSize = 16;

                const evaluate = (items) => {
                    let correct = 0;
                    let loss = 0;
                    items.forEach((item) => {
                        const probabilities = this.forward(item.feature, model).probabilities;
                        const predicted = probabilities.indexOf(Math.max(...probabilities));
                        if (predicted === item.label) correct += 1;
                        loss -= Math.log(Math.max(1e-8, probabilities[item.label]));
                    });
                    return {
                        accuracy: correct / items.length,
                        loss: loss / items.length
                    };
                };

                for (let epoch = 1; epoch <= maximumEpochs; epoch += 1) {
                    const order = training.map((_, index) => index);
                    for (let index = order.length - 1; index > 0; index -= 1) {
                        const swapIndex = Math.floor(random() * (index + 1));
                        [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
                    }

                    for (let batchStart = 0; batchStart < order.length; batchStart += batchSize) {
                        const batch = order.slice(batchStart, batchStart + batchSize);
                        const gradients = {
                            w1: new Array(model.w1.length).fill(0),
                            b1: new Array(model.b1.length).fill(0),
                            w2: new Array(model.w2.length).fill(0),
                            b2: new Array(model.b2.length).fill(0)
                        };

                        batch.forEach((itemIndex) => {
                            const item = training[itemIndex];
                            const augmented = item.feature.map((value) => value + (random() * 2 - 1) * 0.035);
                            const output = this.forward(augmented, model);
                            const outputGradient = [...output.probabilities];
                            outputGradient[item.label] -= 1;

                            for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
                                gradients.b2[classIndex] += outputGradient[classIndex];
                                const offset = classIndex * hiddenSize;
                                for (let hiddenIndex = 0; hiddenIndex < hiddenSize; hiddenIndex += 1) {
                                    gradients.w2[offset + hiddenIndex] += outputGradient[classIndex] * output.hidden[hiddenIndex];
                                }
                            }

                            for (let hiddenIndex = 0; hiddenIndex < hiddenSize; hiddenIndex += 1) {
                                if (output.hidden[hiddenIndex] <= 0) continue;
                                let hiddenGradient = 0;
                                for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
                                    hiddenGradient += model.w2[classIndex * hiddenSize + hiddenIndex]
                                        * outputGradient[classIndex];
                                }
                                gradients.b1[hiddenIndex] += hiddenGradient;
                                const offset = hiddenIndex * inputSize;
                                for (let inputIndex = 0; inputIndex < inputSize; inputIndex += 1) {
                                    gradients.w1[offset + inputIndex] += hiddenGradient * augmented[inputIndex];
                                }
                            }
                        });

                        updateStep += 1;
                        const learningRate = 0.004 * Math.pow(0.985, Math.floor(epoch / 12));
                        parameterNames.forEach((name) => {
                            for (let index = 0; index < model[name].length; index += 1) {
                                const gradient = gradients[name][index] / batch.length;
                                firstMoment[name][index] = 0.9 * firstMoment[name][index] + 0.1 * gradient;
                                secondMoment[name][index] = 0.999 * secondMoment[name][index]
                                    + 0.001 * gradient * gradient;
                                const correctedFirst = firstMoment[name][index] / (1 - Math.pow(0.9, updateStep));
                                const correctedSecond = secondMoment[name][index] / (1 - Math.pow(0.999, updateStep));
                                model[name][index] -= learningRate * correctedFirst
                                    / (Math.sqrt(correctedSecond) + 1e-8);
                            }
                        });
                    }

                    completedEpochs = epoch;
                    const metrics = evaluate(validation);
                    if (metrics.loss < bestLoss - 0.0005) {
                        bestLoss = metrics.loss;
                        bestAccuracy = metrics.accuracy;
                        bestWeights = {
                            w1: [...model.w1], b1: [...model.b1],
                            w2: [...model.w2], b2: [...model.b2]
                        };
                        staleEpochs = 0;
                    } else {
                        staleEpochs += 1;
                    }

                    if (onProgress && (epoch === 1 || epoch % 5 === 0)) {
                        onProgress({ epoch, maximumEpochs, ...metrics, classes: [...classes] });
                    }
                    if (epoch % 5 === 0) {
                        await new Promise((resolve) => global.setTimeout(resolve, 0));
                    }
                    if (epoch >= 50 && staleEpochs >= 24) break;
                }

                if (bestWeights) Object.assign(model, bestWeights);
                model.validationAccuracy = bestAccuracy;
                model.validationLoss = bestLoss;
                model.epochs = completedEpochs;
                model.trainedAt = new Date().toISOString();
                this.model = model;
                this.save();
                return this.getStatus();
            } finally {
                this.training = false;
            }
        }
    }

    function matchesExtension(actual, expected) {
        const weights = [0.65, 1, 1, 1, 1];
        let error = 0;
        let weight = 0;
        actual.forEach((value, index) => {
            error += Math.abs(value - expected[index]) * weights[index];
            weight += weights[index];
        });
        return clamp(1 - error / weight);
    }

    function closeScore(value, limit) {
        return clamp((limit * 1.45 - value) / (limit * 0.85));
    }

    function farScore(value, minimum) {
        return clamp((value - minimum * 0.65) / (minimum * 0.8));
    }

    class LibrasAlphabetRecognizer {
        constructor(options = {}) {
            this.storageKey = options.storageKey || 'jovi.libras.calibration.v5';
            this.neuralStorageKey = options.neuralStorageKey || 'jovi.libras.neural.v1';
            this.minimumCalibrationSamples = options.minimumCalibrationSamples || 20;
            this.voteWindowSize = options.voteWindowSize || 9;
            this.minimumVotes = options.minimumVotes || 6;
            this.calibration = this.loadCalibration();
            this.neuralNetwork = new PersonalLibrasNeuralNetwork(this.neuralStorageKey);
            this.motionBuffer = [];
            this.voteBuffer = [];
            this.lastDynamicLetter = null;
            this.lastDynamicAt = -Infinity;
            this.staticCandidateLetter = null;
            this.staticCandidateSince = 0;
        }

        static get staticLetters() { return [...STATIC_LETTERS]; }
        static get dynamicLetters() { return [...DYNAMIC_LETTERS]; }

        loadCalibration() {
            try {
                const stored = global.localStorage && global.localStorage.getItem(this.storageKey);
                if (!stored) return {};
                const parsed = JSON.parse(stored);
                if (parsed.version !== STORAGE_VERSION || typeof parsed.samples !== 'object') return {};
                delete parsed.samples.X;
                return parsed.samples;
            } catch (error) {
                console.warn('Não foi possível carregar a calibração de Libras:', error);
                return {};
            }
        }

        saveCalibration() {
            try {
                if (global.localStorage) {
                    global.localStorage.setItem(this.storageKey, JSON.stringify({
                        version: STORAGE_VERSION,
                        samples: this.calibration
                    }));
                }
            } catch (error) {
                console.warn('Não foi possível salvar a calibração de Libras:', error);
            }
        }

        getCalibrationSummary() {
            const perLetter = {};
            STATIC_LETTERS.forEach((letter) => {
                perLetter[letter] = Array.isArray(this.calibration[letter])
                    ? this.calibration[letter].length
                    : 0;
            });
            return {
                perLetter,
                readyLetters: STATIC_LETTERS.filter((letter) => perLetter[letter] >= this.minimumCalibrationSamples),
                totalStaticLetters: STATIC_LETTERS.length,
                neural: this.neuralNetwork.getStatus()
            };
        }

        getNeuralStatus() {
            return this.neuralNetwork.getStatus();
        }

        trainPersonalNetwork(onProgress) {
            return this.neuralNetwork.train(
                this.calibration,
                this.minimumCalibrationSamples,
                onProgress
            );
        }

        addCalibrationSample(letter, landmarks) {
            const normalizedLetter = String(letter || '').toUpperCase();
            if (!STATIC_LETTERS.includes(normalizedLetter)) {
                throw new Error('A calibração manual aceita somente letras de configuração estática.');
            }
            const descriptor = this.extractDescriptor(landmarks);
            if (!descriptor) return 0;
            if (!Array.isArray(this.calibration[normalizedLetter])) this.calibration[normalizedLetter] = [];
            this.calibration[normalizedLetter].push(descriptor.feature);
            if (this.calibration[normalizedLetter].length > 60) {
                this.calibration[normalizedLetter].shift();
            }
            return this.calibration[normalizedLetter].length;
        }

        finishCalibration() {
            this.saveCalibration();
            this.resetTracking();
        }

        clearCalibration(letter) {
            if (letter) {
                delete this.calibration[String(letter).toUpperCase()];
            } else {
                this.calibration = {};
            }
            // Os pesos antigos não podem continuar ativos depois de removermos
            // dados rotulados. A interface recria a rede com as letras restantes.
            this.neuralNetwork.clear();
            this.saveCalibration();
            this.resetTracking();
        }

        resetTracking() {
            this.motionBuffer = [];
            this.voteBuffer = [];
            this.staticCandidateLetter = null;
            this.staticCandidateSince = 0;
        }

        extractDescriptor(landmarks) {
            if (!Array.isArray(landmarks) || landmarks.length < 21) return null;
            const lm = landmarks.slice(0, 21).map(point);
            if (lm.some((item) => !Number.isFinite(item.x) || !Number.isFinite(item.y))) return null;

            const wrist = lm[0];
            const longitudinal = normalize(subtract(lm[9], wrist));
            const rawLateral = subtract(lm[17], lm[5]);
            const lateralWithoutLongitudinal = {
                x: rawLateral.x - dot(rawLateral, longitudinal) * longitudinal.x,
                y: rawLateral.y - dot(rawLateral, longitudinal) * longitudinal.y,
                z: rawLateral.z - dot(rawLateral, longitudinal) * longitudinal.z
            };
            let lateral = normalize(lateralWithoutLongitudinal);
            let normal = normalize(cross(longitudinal, lateral));
            lateral = normalize(cross(normal, longitudinal));

            const palmLength = distance(wrist, lm[9]);
            const palmWidth = distance(lm[5], lm[17]);
            const scale = Math.max(1e-5, (palmLength + palmWidth) / 2);

            if (magnitude(longitudinal) < 0.9 || magnitude(lateral) < 0.9 || magnitude(normal) < 0.9) {
                return null;
            }

            const local = lm.map((landmark) => {
                const relative = subtract(landmark, wrist);
                return {
                    x: dot(relative, longitudinal) / scale,
                    y: dot(relative, lateral) / scale,
                    z: dot(relative, normal) / scale
                };
            });

            const chains = [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
                [17, 18, 19, 20]
            ];
            const extension = chains.map((chain) => {
                const proximal = angleAt(lm[chain[0]], lm[chain[1]], lm[chain[2]]);
                const distal = angleAt(lm[chain[1]], lm[chain[2]], lm[chain[3]]);
                return clamp(((proximal + distal) / 2 - 72) / 102);
            });

            const normalizedDistance = (first, second) => distance(lm[first], lm[second]) / scale;
            const contacts = {
                thumbIndex: normalizedDistance(4, 8),
                thumbMiddle: normalizedDistance(4, 12),
                thumbRing: normalizedDistance(4, 16),
                thumbPinky: normalizedDistance(4, 20),
                thumbIndexPip: normalizedDistance(4, 6),
                thumbMiddlePip: normalizedDistance(4, 10),
                indexMiddle: normalizedDistance(8, 12),
                middleRing: normalizedDistance(12, 16),
                ringPinky: normalizedDistance(16, 20),
                indexPinky: normalizedDistance(8, 20),
                thumbIndexMcp: normalizedDistance(4, 5)
            };

            const screenPalm = subtract(lm[9], wrist);
            const screenPalmLength = Math.hypot(screenPalm.x, screenPalm.y) || 1;
            const screenDirection = {
                x: screenPalm.x / screenPalmLength,
                y: screenPalm.y / screenPalmLength
            };
            const cameraNormal = normalize(cross(
                subtract(lm[5], wrist),
                subtract(lm[17], wrist)
            ));
            const cameraFacing = Math.abs(cameraNormal.z);

            const feature = [];
            local.slice(1).forEach((item) => feature.push(item.x * 0.55, item.y * 0.55, item.z * 0.25));
            extension.forEach((value) => feature.push(value * 1.2));
            Object.values(contacts).forEach((value) => feature.push(value * 0.55));
            // Orientação é um parâmetro linguístico: diferencia, por exemplo,
            // V (para cima), P (lateral) e N (para baixo).
            feature.push(screenDirection.x * 0.95, screenDirection.y * 0.95);
            // Rotação da palma em relação à câmera. Sem isso H e U ficam quase
            // idênticos depois da normalização anatômica.
            feature.push(
                Math.abs(cameraNormal.x) * 0.65,
                Math.abs(cameraNormal.y) * 0.65,
                cameraFacing * 0.8
            );

            return {
                lm,
                local,
                scale,
                extension,
                contacts,
                screenDirection,
                cameraNormal,
                cameraFacing,
                feature
            };
        }

        classifyPersonalNeural(descriptor) {
            const prediction = this.neuralNetwork.predict(descriptor.feature);
            if (!prediction) return null;
            const samples = this.calibration[prediction.letter];
            if (!Array.isArray(samples) || samples.length < this.minimumCalibrationSamples) return null;

            const centroid = meanVector(samples);
            const internalDistances = samples.map((sample) => rmsDistance(sample, centroid));
            const nearestDistances = samples
                .map((sample) => rmsDistance(descriptor.feature, sample))
                .sort((first, second) => first - second)
                .slice(0, Math.min(5, samples.length));
            const sampleDistance = Math.min(
                rmsDistance(descriptor.feature, centroid),
                average(nearestDistances) * 1.08
            );
            const radius = Math.max(0.1, percentile(internalDistances, 0.9) * 3.2 + 0.025);
            const proximity = Math.exp(-0.5 * Math.pow(sampleDistance / radius, 2));
            const classCount = this.neuralNetwork.getStatus().classes.length;
            const requiredProbability = classCount <= 3 ? 0.72 : 0.52;
            if (
                prediction.probability < requiredProbability
                || prediction.margin < 0.12
                || sampleDistance > radius * 1.3
                || proximity < 0.38
            ) return null;

            return {
                letter: prediction.letter,
                confidence: clamp(0.66 + prediction.probability * 0.2 + proximity * 0.1, 0.66, 0.96),
                source: 'rede-neural-pessoal',
                score: prediction.probability,
                margin: prediction.margin
            };
        }

        classifyCalibrated(descriptor) {
            const profiles = [];
            STATIC_LETTERS.forEach((letter) => {
                const samples = this.calibration[letter];
                if (!Array.isArray(samples) || samples.length < this.minimumCalibrationSamples) return;
                const centroid = meanVector(samples);
                const internalDistances = samples.map((sample) => rmsDistance(sample, centroid));
                const nearestDistances = samples
                    .map((sample) => rmsDistance(descriptor.feature, sample))
                    .sort((a, b) => a - b)
                    .slice(0, Math.min(5, samples.length));
                // A captura da câmera varia um pouco entre sessões, mesmo para a
                // mesma mão. O raio mínimo evita que uma calibração feita em 30
                // quadros quase idênticos fique estreita demais no uso seguinte.
                const radius = Math.max(0.065, percentile(internalDistances, 0.9) * 3 + 0.02);
                const centroidDistance = rmsDistance(descriptor.feature, centroid);
                // Usa tanto o centro geral quanto os exemplos mais próximos.
                // Assim, duas calibrações em ângulos diferentes não viram uma
                // média artificial entre as duas posições.
                const prototypeDistance = average(nearestDistances);
                const sampleDistance = Math.min(centroidDistance, prototypeDistance * 1.08);
                const score = Math.exp(-0.5 * Math.pow(sampleDistance / radius, 2));
                profiles.push({ letter, score, distance: sampleDistance, radius });
            });
            if (!profiles.length) return null;

            profiles.sort((a, b) => b.score - a.score);
            const first = profiles[0];
            const second = profiles[1];
            const margin = second ? first.score - second.score : first.score;
            const requiredScore = second ? 0.44 : 0.58;
            if (first.score < requiredScore || (second && margin < 0.055)) return null;

            return {
                letter: first.letter,
                confidence: clamp(0.62 + first.score * 0.35, 0.62, 0.97),
                source: 'calibrado',
                score: first.score,
                margin
            };
        }

        classifyLibrasConfiguration(descriptor) {
            const e = descriptor.extension;
            const d = descriptor.contacts;
            const n = descriptor.local;
            const direction = descriptor.screenDirection;
            const candidates = [];
            const add = (letter, expected, details = [], penalty = 0) => {
                const detailScore = details.length ? average(details) : 0.75;
                const score = clamp(matchesExtension(e, expected) * 0.72 + detailScore * 0.28 - penalty);
                candidates.push({ letter, score });
            };

            const fingersTogether = average([
                closeScore(d.indexMiddle, 0.62),
                closeScore(d.middleRing, 0.58),
                closeScore(d.ringPinky, 0.55)
            ]);
            const twoTogether = closeScore(d.indexMiddle, 0.55);
            const twoApart = farScore(d.indexMiddle, 0.55);
            const threeSpread = average([
                farScore(d.middleRing, 0.42),
                farScore(d.ringPinky, 0.38)
            ]);
            const thumbIndexTouch = closeScore(d.thumbIndex, 0.48);
            const thumbMiddleTouch = closeScore(d.thumbMiddle, 0.52);
            const thumbMiddleTouchStrict = closeScore(d.thumbMiddle, 0.26);
            const palmUp = clamp((-direction.y + 0.15) / 1.15);
            const palmDown = clamp((direction.y + 0.15) / 1.15);
            const palmHorizontal = clamp((Math.abs(direction.x) - 0.35) / 0.65);
            const palmFacingCamera = clamp((descriptor.cameraFacing - 0.3) / 0.58);
            const palmEdgeOn = clamp((0.72 - descriptor.cameraFacing) / 0.5);
            const crossed = ((n[8].y - n[12].y) * (n[5].y - n[9].y)) < 0 ? 1 : 0;
            const thumbAtIndexSide = clamp((n[5].y - n[4].y + 0.08) / 0.58);
            const thumbAcrossPalm = clamp((n[4].y - n[5].y + 0.05) / 0.72);
            const fingertipCluster = average([
                closeScore(d.thumbIndex, 0.55),
                closeScore(d.thumbMiddle, 0.62),
                closeScore(d.thumbRing, 0.7)
            ]);

            // Configurações do alfabeto manual brasileiro exibido na referência.
            add('B', [0.15, 1, 1, 1, 1], [fingersTogether, palmUp]);
            add('F', [0.5, 0.38, 1, 1, 1], [thumbIndexTouch, threeSpread, palmFacingCamera, palmUp]);
            add('T', [0.45, 0.35, 1, 1, 1], [thumbIndexTouch, fingersTogether], 0.015);
            add('D', [0.45, 1, 0.08, 0.08, 0.08], [thumbMiddleTouchStrict, palmUp]);
            add('G', [0.3, 1, 0.05, 0.05, 0.05], [
                closeScore(d.thumbIndexMcp, 0.55),
                farScore(d.thumbMiddle, 0.38),
                1 - thumbMiddleTouchStrict,
                palmUp
            ]);
            add('I', [0.2, 0.05, 0.05, 0.05, 1], [1 - e[0], palmUp]);
            add('L', [0.8, 1, 0.05, 0.05, 0.05], [e[0], thumbAtIndexSide, farScore(d.thumbIndex, 0.9), palmUp]);
            add('Y', [0.8, 0.05, 0.05, 0.05, 1], [e[0], thumbAtIndexSide, farScore(d.thumbPinky, 1), palmUp]);

            add('K', [0.65, 1, 1, 0.05, 0.05], [closeScore(d.thumbMiddlePip, 0.62), twoApart, palmFacingCamera, palmUp]);
            add('U', [0.2, 1, 1, 0.05, 0.05], [twoTogether, 1 - crossed, palmFacingCamera, palmUp]);
            add('V', [0.42, 1, 1, 0.05, 0.05], [twoApart, 1 - crossed, farScore(d.thumbMiddlePip, 0.62), palmUp]);
            add('R', [0.25, 1, 1, 0.05, 0.05], [crossed, twoTogether]);
            add('P', [0.45, 1, 1, 0.05, 0.05], [palmHorizontal, twoApart, 1 - thumbMiddleTouch]);
            // H usa a mesma dupla de dedos de U, mas com a mão rotacionada.
            // A orientação da palma, e não a direção dos dedos na tela, é o que
            // separa as duas configurações na referência brasileira.
            // O polegar pode variar ao sustentar os dedos recolhidos; por isso
            // H avalia principalmente indicador/médio juntos e palma de lado.
            add('H', [e[0], 1, 1, 0.18, 0.18], [twoTogether, palmEdgeOn, 1 - crossed]);

            add('W', [0.2, 1, 1, 1, 0.05], [farScore(d.indexPinky, 1.15), palmUp]);
            add('Q', [0.35, 0.75, 0.08, 0.08, 0.08], [palmDown, thumbIndexTouch], 0.015);

            add('O', [0.45, 0.45, 0.45, 0.45, 0.4], [fingertipCluster, closeScore(d.thumbPinky, 0.82)]);
            add('C', [0.75, 0.8, 0.8, 0.8, 0.78], [
                farScore(d.thumbIndex, 0.62),
                closeScore(d.indexPinky, 1.7)
            ]);

            add('A', [0.62, 0.05, 0.05, 0.05, 0.05], [thumbAtIndexSide, closeScore(d.thumbIndexMcp, 0.9)]);
            add('E', [0.2, 0.08, 0.08, 0.08, 0.08], [fingertipCluster, closeScore(d.thumbPinky, 0.85)], 0.02);
            add('S', [0.45, 0.05, 0.05, 0.05, 0.05], [thumbAcrossPalm, thumbMiddleTouch], 0.02);
            add('M', [0.38, 1, 1, 1, 0.08], [palmDown, fingersTogether]);
            add('N', [0.38, 1, 1, 0.08, 0.08], [palmDown, twoTogether]);

            candidates.sort((a, b) => b.score - a.score);
            const first = candidates[0];
            const second = candidates[1];
            if (!first || first.score < 0.73 || (second && first.score - second.score < 0.035)) return null;

            const ambiguous = ['A', 'D', 'E', 'F', 'G', 'H', 'K', 'M', 'N', 'P', 'Q', 'R', 'S', 'T'];
            const confidenceCap = ambiguous.includes(first.letter) ? 0.78 : 0.86;
            const confidence = clamp(0.52 + (first.score - 0.7) * 1.15, 0.52, confidenceCap);
            return {
                letter: first.letter,
                confidence,
                source: 'libras-base',
                score: first.score,
                margin: second ? first.score - second.score : first.score
            };
        }

        updateMotion(descriptor, timestamp, shapePrediction = null) {
            const { lm, scale, extension } = descriptor;
            const relative = (tipIndex) => ({
                x: (lm[tipIndex].x - lm[0].x) / scale,
                y: (lm[tipIndex].y - lm[0].y) / scale
            });
            const cShapeByGeometry = extension.slice(1).every((value) => value > 0.48 && value < 0.96)
                && descriptor.contacts.thumbIndex > 0.38;
            const cShape = cShapeByGeometry || (shapePrediction && shapePrediction.letter === 'C');
            this.motionBuffer.push({
                time: timestamp,
                index: relative(8),
                pinky: relative(20),
                indexScreen: { x: lm[8].x, y: lm[8].y },
                pinkyScreen: { x: lm[20].x, y: lm[20].y },
                wrist: { x: lm[0].x, y: lm[0].y },
                scale,
                indexOnly: extension[1] > 0.78 && extension[2] < 0.35 && extension[3] < 0.35 && extension[4] < 0.35,
                pinkyOnly: extension[4] > 0.76 && extension[1] < 0.35 && extension[2] < 0.35 && extension[3] < 0.35,
                cShape
            });
            this.motionBuffer = this.motionBuffer.filter((sample) => timestamp - sample.time <= 1150);

            const recent = this.motionBuffer.filter((sample) => timestamp - sample.time <= 260);
            let speed = 0;
            if (recent.length >= 2) {
                const trajectorySpeed = (samples, key) => {
                    if (samples.length < 2) return 0;
                    const first = samples[0];
                    const last = samples[samples.length - 1];
                    const elapsed = Math.max(0.001, (last.time - first.time) / 1000);
                    const averageScale = Math.max(1e-5, average(samples.map((sample) => sample.scale)));
                    return Math.hypot(last[key].x - first[key].x, last[key].y - first[key].y)
                        / averageScale / elapsed;
                };
                const indexRecent = recent.filter((sample) => sample.indexOnly);
                const pinkyRecent = recent.filter((sample) => sample.pinkyOnly);
                speed = Math.max(
                    trajectorySpeed(recent, 'wrist'),
                    trajectorySpeed(indexRecent, 'indexScreen'),
                    trajectorySpeed(pinkyRecent, 'pinkyScreen')
                );
            }
            return { speed, moving: speed > 0.55 };
        }

        directionRuns(samples, key) {
            const runs = [];
            for (let index = 1; index < samples.length; index += 1) {
                const deltaX = samples[index][key].x - samples[index - 1][key].x;
                const deltaY = samples[index][key].y - samples[index - 1][key].y;
                if (Math.abs(deltaX) < 0.02) continue;
                const sign = Math.sign(deltaX);
                if (!runs.length || runs[runs.length - 1].sign !== sign) {
                    runs.push({
                        sign,
                        distance: Math.abs(deltaX),
                        deltaX,
                        deltaY,
                        start: index - 1,
                        end: index
                    });
                } else {
                    const run = runs[runs.length - 1];
                    run.distance += Math.abs(deltaX);
                    run.deltaX += deltaX;
                    run.deltaY += deltaY;
                    run.end = index;
                }
            }
            return runs.filter((run) => run.distance > 0.12);
        }

        isZTrajectory(trajectory) {
            const stats = this.trajectoryStats(trajectory, 'indexScreen');
            if (stats.xSpan < 0.48 || stats.ySpan < 0.18 || stats.path < 1.05) return false;

            const runs = this.directionRuns(trajectory, 'indexScreen');
            if (runs.length < 3) return false;

            // O Z em Libras tem três traços: horizontal, diagonal descendente
            // no sentido oposto e outro horizontal. Aceitamos a imagem
            // espelhada da câmera, mas não um zigue-zague horizontal qualquer.
            for (let index = 0; index <= runs.length - 3; index += 1) {
                const [top, diagonal, bottom] = runs.slice(index, index + 3);
                const alternates = top.sign === bottom.sign && diagonal.sign === -top.sign;
                const topHorizontal = Math.abs(top.deltaY) <= Math.abs(top.deltaX) * 0.85;
                const bottomHorizontal = Math.abs(bottom.deltaY) <= Math.abs(bottom.deltaX) * 0.85;
                const diagonalEnough = Math.abs(diagonal.deltaY) >= 0.14
                    && Math.abs(diagonal.deltaY) >= Math.abs(diagonal.deltaX) * 0.22;
                const verticalDirection = Math.sign(diagonal.deltaY || 1);
                const outerDoNotReverseVertical = (
                    Math.sign(top.deltaY || verticalDirection) === verticalDirection
                    || Math.abs(top.deltaY) < 0.08
                ) && (
                    Math.sign(bottom.deltaY || verticalDirection) === verticalDirection
                    || Math.abs(bottom.deltaY) < 0.08
                );
                if (alternates && topHorizontal && bottomHorizontal
                    && diagonalEnough && outerDoNotReverseVertical) {
                    return true;
                }
            }
            return false;
        }

        confirmDynamic(letter, confidence, source, timestamp) {
            this.lastDynamicLetter = letter;
            this.lastDynamicAt = timestamp;
            // Sem limpar, os mesmos quadros antigos voltavam a confirmar a
            // letra após o cooldown, mesmo com a mão já parada.
            this.motionBuffer = [];
            return { letter, confidence, source };
        }

        trajectoryStats(samples, key) {
            if (samples.length < 2) return { xSpan: 0, ySpan: 0, path: 0, direct: 0 };
            const xs = samples.map((sample) => sample[key].x);
            const ys = samples.map((sample) => sample[key].y);
            let path = 0;
            for (let index = 1; index < samples.length; index += 1) {
                path += Math.hypot(xs[index] - xs[index - 1], ys[index] - ys[index - 1]);
            }
            return {
                xSpan: Math.max(...xs) - Math.min(...xs),
                ySpan: Math.max(...ys) - Math.min(...ys),
                path,
                direct: Math.hypot(xs[xs.length - 1] - xs[0], ys[ys.length - 1] - ys[0])
            };
        }

        normalizeScreenTrajectory(samples, key) {
            if (!samples.length) return [];
            const reference = samples[0][key];
            const trajectoryScale = Math.max(1e-5, average(samples.map((sample) => sample.scale)));
            return samples.map((sample) => ({
                ...sample,
                [key]: {
                    x: (sample[key].x - reference.x) / trajectoryScale,
                    y: (sample[key].y - reference.y) / trajectoryScale
                }
            }));
        }

        detectDynamicLetter(timestamp) {
            if (timestamp - this.lastDynamicAt < 1400) return null;

            const indexSamples = this.motionBuffer.filter((sample) => sample.indexOnly);
            if (indexSamples.length >= 9) {
                const trajectory = this.normalizeScreenTrajectory(indexSamples, 'indexScreen');
                if (this.isZTrajectory(trajectory)) {
                    return this.confirmDynamic('Z', 0.9, 'movimento-z', timestamp);
                }
            }

            const pinkySamples = this.motionBuffer.filter((sample) => sample.pinkyOnly);
            if (pinkySamples.length >= 9) {
                const trajectory = this.normalizeScreenTrajectory(pinkySamples, 'pinkyScreen');
                const stats = this.trajectoryStats(trajectory, 'pinkyScreen');
                const curvedEnough = stats.path > Math.max(0.65, stats.direct * 1.18);
                if (stats.xSpan > 0.22 && stats.ySpan > 0.38 && curvedEnough) {
                    return this.confirmDynamic('J', 0.87, 'movimento-j', timestamp);
                }
            }

            const cSamples = this.motionBuffer.filter((sample) => sample.cShape);
            if (cSamples.length >= 8) {
                const normalizedCSamples = this.normalizeScreenTrajectory(cSamples, 'wrist');
                const stats = this.trajectoryStats(normalizedCSamples, 'wrist');
                const runs = this.directionRuns(normalizedCSamples, 'wrist');
                if (runs.length >= 2 && stats.xSpan > 0.42 && stats.path > 0.8) {
                    return this.confirmDynamic('Ç', 0.86, 'movimento-cedilha', timestamp);
                }
            }
            return null;
        }

        process(landmarks, timestamp = (global.performance ? global.performance.now() : Date.now())) {
            const descriptor = this.extractDescriptor(landmarks);
            if (!descriptor) return { status: 'sem-mao', motion: { speed: 0, moving: false } };

            const staticPrediction = this.classifyPersonalNeural(descriptor)
                || this.classifyCalibrated(descriptor)
                || this.classifyLibrasConfiguration(descriptor);
            const motion = this.updateMotion(descriptor, timestamp, staticPrediction);
            const dynamic = this.detectDynamicLetter(timestamp);
            if (dynamic) {
                this.voteBuffer = [];
                return { ...dynamic, status: 'confirmado', motion, dynamic: true };
            }

            let prediction = null;
            if (!motion.moving) {
                prediction = staticPrediction;
            }

            this.voteBuffer.push(prediction);
            if (this.voteBuffer.length > this.voteWindowSize) this.voteBuffer.shift();
            if (!prediction) {
                this.staticCandidateLetter = null;
                this.staticCandidateSince = 0;
                return { status: motion.moving ? 'movimento' : 'incerto', motion };
            }

            if (this.staticCandidateLetter !== prediction.letter) {
                this.staticCandidateLetter = prediction.letter;
                this.staticCandidateSince = timestamp;
            }

            const matching = this.voteBuffer.filter((item) => item && item.letter === prediction.letter);
            // C/Ç, I/J e a postura inicial de Z precisam de tempo para sabermos
            // se o usuário manterá a letra estática ou começará a trajetória.
            const canBecomeDynamic = ['C', 'D', 'G', 'I'].includes(prediction.letter);
            const minimumHoldTime = canBecomeDynamic ? 620 : 0;
            if (matching.length < this.minimumVotes || timestamp - this.staticCandidateSince < minimumHoldTime) {
                return { ...prediction, status: 'estabilizando', motion };
            }

            return {
                ...prediction,
                confidence: average(matching.map((item) => item.confidence)),
                status: 'confirmado',
                motion,
                dynamic: false
            };
        }
    }

    global.LibrasAlphabetRecognizer = LibrasAlphabetRecognizer;
    if (typeof module !== 'undefined' && module.exports) module.exports = LibrasAlphabetRecognizer;
}(typeof window !== 'undefined' ? window : globalThis));
