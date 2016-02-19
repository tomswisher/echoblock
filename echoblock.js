'use strict';

// Adapted from remix.js example code by Paul Lamere + tkell (Thor) + Echonest
// https://github.com/echonest/remix.js/blob/master/examples
// Song is public domain from Archive.org
// https://archive.org/details/BeethovensSymphonyNo.9_51

var echonestAPIKey, trackID, trackURL;
trackID = 'TRCYWPQ139279B3308';
trackURL = 'BeethovensSymphonyNo9scherzo.mp3'
var remixer;
var remixPlayer;
var track;
var remixedArray;

var widthUnit = 100;
var heightUnit = 25;
var maxLevel = 0;
var maxDuration = 0;
var lastQuantaOnTop = true;

var d3Stage;

function InitializePage() {
    echonestAPIKey = localStorage.getItem('echonestAPIKey') || '';
    $('#echonestAPIKeyForm').val(echonestAPIKey);
    trackURL = localStorage.getItem('trackURL') || '';
    $('#trackURLForm').val(trackURL);

    $('#trackURLForm').click(function() {
        $('#trackURLFile').trigger('click');
    });

    $('#trackURLFile').change(function(event) {
        console.log(event.target.files[0].name);
        console.log(event.target.files[0].webkitRelativePath);
        trackURL = this.value.split('\\').pop();
        $('#trackURLForm').val(trackURL);
    });
    // AnalyzeTrack(); // debug
}

function AnalyzeTrack() {
    d3.select('div#d3Stage').selectAll('svg').selectAll('*').remove();
    var context;
    echonestAPIKey = $('#echonestAPIKeyForm').val();
    localStorage.setItem('echonestAPIKey', echonestAPIKey);
    trackURL = $('#trackURLForm').val();
    localStorage.setItem('trackURL', trackURL);
    var contextFunction = window.AudioContext || window.webkitAudioContext;
    if (contextFunction === undefined) {
        $('#analysisText').text('Sorry, this app needs advanced web audio. Your browser does not support it. Try the latest version of Chrome?');
    } else {
        d3.select('#analyzeButton').classed('not-needed', true);
        context = new contextFunction();
        remixer = createJRemixer(context, $, echonestAPIKey);
        remixPlayer = remixer.getPlayer();
        $('#analysisText').text('Analyzing your track...');
        remixer.remixTrackById(trackID, trackURL, function(returnedTrack, percent) {

            track = returnedTrack;
            if (isFinite(percent)) {
                $('#analysisText').text('Analyzing at ' + percent + '%');
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
                $('#analysisText').text('Ready');
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
                .on('click', function(d) {
                    remixPlayer.stop();
                    var currentlyPlaying = d.playing;
                    d3.select('div#d3Stage').selectAll('rect.echo-rect').interrupt();
                    d3.select('div#d3Stage').selectAll('rect.echo-rect')
                        .style('opacity', 1)
                        .attr('x', function(d) { return d.quantum.start * widthUnit; })
                        .attr('width', function(d) { return d.originalWidth; })
                        .each(function(d) { d.playing = false; });
                    if (!currentlyPlaying) {
                        remixPlayer.play(0, d.quantum);
                        d.playing = true;
                        d3.select(this)
                            .style('opacity', 0)
                            .attr('width', 0)
                            .transition().ease('linear').duration(function(d) { return 1000*d.quantum.duration; })
                                .style('opacity', 1)
                                .attr('width', function(d) { return d.originalWidth; })
                                .each('end', function(d) { d.playing = false; });
                    }
                });
    }
}

function UpdateQuanta() {
    var transitionEaseX = 'cubic-out', transitionEaseY = 'bounce', easeX = 'linear';
    d3Stage.selectAll('g.echo-group').transition()
        .ease(transitionEaseY)
        .duration(function(d) { return 1000; })
        .attr('transform', function(d) {
            var yOffset = lastQuantaOnTop ? (maxLevel-d.level)*heightUnit : d.level*heightUnit; 
            return 'translate(' + '0' + ',' + String(yOffset) + ')';
        })
        .call(AllTransitionsEnded, function() {
            d3Stage.selectAll('g.echo-group').selectAll('rect.echo-rect, text.echo-text').transition()
                .ease(transitionEaseX)        
                // .duration(function(d,i) { return Math.min(4*1000-i, 0); })
                .duration(3000)
                // .delay(function(d,i) { return Math.min(4*1000, i); })
                .delay(function(d,i,j) { return 300*j+(i/d.analysisArrayLength)*1000; })
                .attr('x', function(d) { return d.quantum.start * widthUnit; })
                .call(AllTransitionsEnded, function() {
                    d3.select('#analyzeButton').classed('not-needed', false);
                });
        });
}

function UpdatePlayer(currentPlayer, action, quantaArray, startTime) {
    var curTime = currentPlayer.curTime();
    if (action === 'play') {
        currentPlayer.play(startTime, quantaArray);
        d3.select('#player').classed('playing', true).classed('stopped', false);
    }
    else if (action === 'stop') {
        currentPlayer.stop();
        d3.select('#player').classed('playing', false).classed('stopped', true);
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

window.onload = InitializePage;