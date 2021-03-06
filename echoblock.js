'use strict';

// Adapted from remix.js example code by Paul Lamere + tkell (Thor) + Echonest
// https://github.com/echonest/remix.js/blob/master/examples

var stemURL = '';
var echonestAPIKey, trackID, trackURL, disableAnimation;
trackID = 'TRCYWPQ139279B3308';
// trackURL = 'BeethovensSymphonyNo9scherzo.mp3'
trackURL = 'andromeda_strain.mp3'
var remixer, remixPlayer;
var track, basicTrack;
var remixedArray;

var widthUnit = 100;
var heightUnit = 25;
var maxLevel = 0;
var maxDuration = 0;
var lastQuantaOnTop = true;
var quantaAnimating = true;
var d3Stage;

function updateSessionStorage(key, inputType) {
    var element = event.srcElement;
    if (inputType === 'checkbox') {
        sessionStorage.setItem(key, element.checked);    
    } else if (inputType === 'form') {
        sessionStorage.setItem(key, element.value);
    }
}

function InitializePage() {
    echonestAPIKey = (sessionStorage.getItem('echonestAPIKey') === null) ? '' : sessionStorage.getItem('echonestAPIKey');
    $('#echonestAPIKeyForm').val(echonestAPIKey);

    // trackURL = sessionStorage.getItem('trackURL') || '';
    // $('#trackURLForm').val(trackURL);

    disableAnimation = (sessionStorage.getItem('disableAnimation') === null) ? true : JSON.parse(sessionStorage.getItem('disableAnimation'));
    $('#disableAnimationCB').prop('checked', disableAnimation);

    // $('#trackURLForm').click(function() {
    //     $('#trackURLFile').trigger('mousedown');
    // });

    // $('#trackURLFile').change(function(event) {
    //     var file = event.target.files[0];
    //     var reader = new FileReader();
    //     reader.onload = (function(theFile) {
    //         console.log(theFile);
    //         return function(e) {
    //             console.log(e.target);
    //         }
    //     })(file);
    //     reader.readAsDataURL(file);
    //     trackURL = this.value.split('\\').pop();
    //     $('#trackURLForm').val(trackURL);
    // });
    // AnalyzeTrack(); // debug
}

window.onload = InitializePage;

// --- functions ---

function AnalyzeTrack() {
    d3.select('#player').classed('not-loaded', true)
    d3.select('div#d3Stage').selectAll('svg')
        .attr('width', 0).attr('height', 0)
        .selectAll('*').remove();
    var context;
    
    echonestAPIKey = $('#echonestAPIKeyForm').val();
    sessionStorage.setItem('echonestAPIKey', echonestAPIKey);
    
    // trackURL = $('#trackURLForm').val();
    // sessionStorage.setItem('trackURL', trackURL);

    disableAnimation = $('#disableAnimationCB').prop('checked');
    sessionStorage.setItem('disableAnimation', disableAnimation);

    var contextFunction = window.AudioContext || window.webkitAudioContext;
    if (contextFunction === undefined) {
        $('#analysisText').text('Sorry, this app needs advanced web audio. Your browser does not support it. Try the latest version of Chrome?');
    } else {
        d3.select('#analyzeButton').classed('not-needed', true);
        context = new contextFunction();
        remixer = createJRemixer(context, $, echonestAPIKey);
        remixPlayer = remixer.getPlayer();
        $('#analysisText').text('Analyzing your track...');
        remixer.remixTrackById(trackID, stemURL+trackURL, function(returnedTrack, percent) {
            track = returnedTrack;
            (function(track) {
                requestAnimationFrame(function() {
                    basicTrack = getBasicTrack(track);
                });
            })(track);
            if (isFinite(percent)) {
                $('#analysisText').text(percent+'%');
            }
            if (percent == 100) {
                $('#analysisText').text('Analysis is finished, loading audio...');
            }
            if (track.status == 'ok') {
                remixedArray = [];
                for (var i=0; i < track.analysis.beats.length; i++) {
                    // if (i % 4 === 0) {
                        remixedArray.push(track.analysis.beats[i]);
                    // }
                }
                $('#analysisText').text('');
                d3.selectAll('.not-loaded').classed('not-loaded', false);
                var index = 0;
                DrawQuanta(track, 'seconds', 'black', index++);
                DrawQuanta(track, 'sections', 'red', index++);
                DrawQuanta(track, 'bars', 'green', index++);
                DrawQuanta(track, 'beats', 'orange', index++);
                DrawQuanta(track, 'tatums', 'blue', index++);
                DrawQuanta(track, 'segments', 'gray', index++);
                UpdateQuanta();
            }
        });
    }
}

function DrawQuanta(track, quantaType, fillColor, level) {
    var analysisArray = track.analysis[quantaType];
    var duration = track.audio_summary.duration;
    maxLevel = level > maxLevel ? level : maxLevel;
    maxDuration = duration > maxDuration ? duration : maxDuration;
    var svgWidth = maxDuration * widthUnit;
    var svgHeight = (maxLevel+1) * heightUnit;
    d3Stage = d3.select('div#d3Stage');
    var dataArray;
    var gOrigin = d3Stage.select('svg')
        .attr('width', svgWidth)
        .attr('height', svgHeight)
        .append('g')
            .datum({'level':level, 'analysisArray':analysisArray})
            .classed('echo-group', true)
            .attr('transform', 'translate(' + '0' + ',' + String(-1*heightUnit) + ')');
    if (quantaType === 'seconds') {
        dataArray = d3.range(Math.floor(duration)).map(function(el) {
            return {'quantum':{'start':el}}; // simulate a quanta object
        });
        gOrigin.selectAll('.echo-second').data(dataArray).enter()
            .append('text')
                .classed('echo-text', true)
                .each(function(d) { d.analysisArrayLength = Math.floor(duration); })
                .attr('x', -1*widthUnit)
                .attr('y', 0.75*heightUnit)
                .text(function(d) { return [d.quantum.start,' s'].join(''); });    
        return;
    }
    else {
        dataArray = analysisArray.map(function(el) { return {'quantum':el}; })
        gOrigin.selectAll('.echo-rect').data(dataArray).enter()
            .append('rect')
                .classed('echo-rect', true)
                .each(function(d) {
                    d.analysisArrayLength = analysisArray.length;
                    d.playing = false;
                })
                .attr('x', 0*widthUnit)
                .attr('y', 0)
                .attr('width', function(d) {
                    d.originalWidth = d.quantum.duration * widthUnit;
                    return d.quantum.duration * widthUnit;
                })
                .attr('height', heightUnit)
                .style('fill', fillColor)
                .on('mousedown', function(d) {
                    if (d.playing === true) { return; }
                    remixPlayer.stop();
                    InterruptAllQuanta();
                    if (quantaAnimating === true) {
                        quantaAnimating = false;
                        d3.select('#analyzeButton').classed('not-needed', false);
                        return;
                    }
                    if (!d.playing) {
                        remixPlayer.play(0, d.quantum);
                        d3.select('#player').classed('playing', false).classed('stopped', true);
                        d.playing = true;
                        d3.select(this)
                            .classed('playing', true)
                            // .style('opacity', 0)
                            .attr('width', 0)
                            // .transition().ease('linear').duration(function(d) { return 1000*d.quantum.duration; })
                            .attr('width', function(d) { return d.originalWidth; })
                            .attr('transform', 'translate(0,0)scale(1,1)')
                            .transition().ease('sine-in').duration(function(d) { return Math.max(140, (1/2)*1000*d.quantum.duration); })
                                .attr('transform', 'translate(0,'+(heightUnit/2)+')scale(1,0)')
                            .transition().ease('sine-out').duration(function(d) { return Math.max(140, (1/2)*1000*d.quantum.duration); })
                                .attr('transform', 'translate(0,0)scale(1,1)')
                                .each('end', function(d) {
                                    d.playing = false;
                                    d3.select(this).classed('playing', false);
                                });
                    }
                });
    }
}

function InterruptAllQuanta() {
    d3.select('#analyzeButton').classed('not-needed', false);
    d3.select('div#d3Stage').selectAll('rect.echo-rect,  text.echo-text').interrupt()
        .classed('playing', false)
        .attr('x', function(d) { return d.quantum.start * widthUnit; })
        // .attr('width', function(d) { return d.originalWidth; })
        .attr('transform', 'translate(0,0)scale(1,1)')
        .each(function(d) { d.playing = false; });
}

function UpdateQuanta() {
    var transitionEaseX = 'cubic-out', transitionEaseY = 'bounce', easeX = 'linear';
    quantaAnimating = true;
    d3Stage.selectAll('g.echo-group').transition()
        .ease(transitionEaseY)
        .duration(function() { return (disableAnimation === true) ? 0 : 1000; })
        .attr('transform', function(d) {
            var yOffset = lastQuantaOnTop ? (maxLevel-d.level)*heightUnit : d.level*heightUnit; 
            return 'translate(' + '0' + ',' + String(yOffset) + ')';
        })
        .call(AllTransitionsEnded, function() {
            d3Stage.selectAll('g.echo-group').selectAll('rect.echo-rect, text.echo-text').transition()
                .ease(transitionEaseX)        
                // .duration(function(d,i) { return Math.min(4*1000-i, 0); })
                .duration(function() { return (disableAnimation === true) ? 0 : 3000; })
                // .delay(function(d,i) { return Math.min(4*1000, i); })
                .delay(function(d,i,j) { return (disableAnimation === true) ? 0 : 300*j+(i/d.analysisArrayLength)*1000; })
                .attr('x', function(d) { return d.quantum.start * widthUnit; })
                .call(AllTransitionsEnded, function() {
                    d3.select('#analyzeButton').classed('not-needed', false);
                    quantaAnimating = false;
                });
        });
}

function UpdatePlayer(currentPlayer, action, quantaArray, startTime) {
    // var curTime = currentPlayer.curTime();
    if (action === 'play') {
        currentPlayer.stop();
        currentPlayer.play(startTime, quantaArray);
        d3.select('#player').classed('playing', true).classed('stopped', false);
        InterruptAllQuanta();
    }
    else if (action === 'stop') {
        currentPlayer.stop();
        d3.select('#player').classed('playing', false).classed('stopped', true);
        InterruptAllQuanta();
    }
    else {
        return;
    }
}

function AllTransitionsEnded(transition, callback) {
    var n = 0;
    transition
        .each(function() {
            n += 1;
        })
        .each('end', function() {
            n -= 1;
            if (n === 0) {
                callback.apply(this, arguments);
            }
        })
}

function getBasicTrack(fullTrack) {
    var basicTrack = {};
    basicTrack['analyzer_version'] = fullTrack['analyzer_version'];
    basicTrack['audio_md5'] = fullTrack['audio_md5'];
    basicTrack['audio_summary'] = $.extend({}, true, fullTrack['audio_summary']);
    basicTrack['bitrate'] = fullTrack['bitrate'];
    basicTrack['buffer'] = $.extend(Object.create(null), true, fullTrack['buffer']);
    basicTrack['id'] = fullTrack['id'];
    basicTrack['md5'] = fullTrack['md5'];
    basicTrack['samplerate'] = fullTrack['samplerate'];
    basicTrack['status'] = fullTrack['status'];
    basicTrack['analysis'] = {};
    basicTrack['analysis']['meta'] = $.extend(true, {}, fullTrack['analysis']['meta']);
    basicTrack['analysis']['track'] = $.extend(true, {}, fullTrack['analysis']['track']);
    var quantaTypeArray = ['bars', 'beats', 'sections', 'segments', 'tatums'];
    var excludedKeys = ['children', 'next', 'oseg', 'overlappingSegments', 'parent', 'prev', 'track'];
    $.each(quantaTypeArray, function(i, quantaType) {
        basicTrack['analysis'][quantaType] = [];
        $.each(fullTrack['analysis'][quantaType], function(j, quanta) {
            var basicQuanta = {};
            $.each(quanta, function(key, value) {
                if (excludedKeys.indexOf(key) !== -1) { return; }
                basicQuanta[key] = value;
            });
            basicTrack['analysis'][quantaType].push(basicQuanta);
        });
    });
    return basicTrack;
}