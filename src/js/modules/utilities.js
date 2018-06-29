
/**
 * There can be many, many scores available to the user. This code allows for
 * managing which scores are visible.
 *
 * By default, only scores that are present on > 85% of PSM entries are visible.
 */
var ScoreDefaults = (function (sd){

    sd.defaultThreshold = 0.85;
    sd.scoreProperties = {};

    sd.resetDOM = function() {
        $('#score_default_div').empty();
        $('#score_defaults').removeAttr("   disabled");
    }

    sd.modifyVisibleScores = function(){
        var rVal = [];
        $('div .score_name').each(function(){
            sd.scoreProperties[$(this).text()] = $(this).hasClass('selected');
        });

        Object.keys(sd.scoreProperties).forEach(function(key){
            if (sd.scoreProperties[key]) {
                rVal.push(key);
            }
        });
        sd.publish('VisibleScores', rVal);

        sd.resetDOM();
    };

    sd.showDOM = function(){

        let domStr = '<div class="col-md-12" id="score_choice_div"><div class="panel panel-default">' +
            '<div class="panel-heading">' +
            '<div class="row">' +
            '<div class="col-md-8">' +
            '<div class="panel-title"><strong>Choose Score Visibility</strong></div>' +
            '</div>' +
            '<div class="col-md-2"><button id="set_score_defaults_btn" class="btn">Set Defaults</button></div>' +
            '<div class="col-md-2"><button id="clear_div_btn" class="btn">Cancel</button></div></div></div>' +
            '<div class="panel-body fixed-height-panel col-md-12"><div class="row">';

        //Build out the panel body
        var scoreStr = '';
        Object.keys(sd.scoreProperties).forEach(function(s, idx){

            if (idx === 0) {
                scoreStr = '<div class="row">';
            }
            if ((idx % 2 === 0) && (idx > 0)) {
                scoreStr += '<div class="row">';
            }

            if (sd.scoreProperties[s]) {
                scoreStr += '<div class="col-md-5 score_name selected"><strong>' + s + '</strong></div>'
            } else {
                scoreStr += '<div class="col-md-5 score_name"><strong>' + s + '</strong></div>'
            }

            if (idx % 2 > 0) {
                scoreStr += '</div>';
            }
        });

        domStr += scoreStr + '</div></div></div></div>';
        $('#score_default_div').append(domStr);
        $('div .score_name').on('click', function(){
            $(this).toggleClass('selected');
        });
        $('#clear_div_btn').on('click', function(){
            sd.resetDOM();
        });
        $('#set_score_defaults_btn').on('click', sd.modifyVisibleScores);
    };

    sd.prepareDOM = function() {
        let b = $('#score_defaults');
        b.removeAttr("disabled");
        b.on('click', function() {
            $('#score_defaults').attr('disabled', 'disabled');
            sd.showDOM();
        });
    };

    sd.init = function () {

        sd.subscribe('RequestVisibleScores', function(){
            var rVal = [];
            Object.keys(sd.scoreProperties).forEach(function(key){
                if (sd.scoreProperties[key]) {
                    rVal.push(key);
                }
            });
            sd.publish('VisibleScores', rVal);
            sd.prepareDOM();
        });

        sd.subscribe('RankedScoresAvailable', function(arg){
            //arg is an array of [scorename, pct coverage] ordered by pct coverage desc
            arg.forEach(function(s){
                if (s[1] > sd.defaultThreshold) {
                    //By default show
                    sd.scoreProperties[s[0]] = true;
                } else {
                    //By default hide
                    sd.scoreProperties[s[0]] = false;
                }
            });

        });
        sd.publish('RequestRankedScores');

    };

    return sd;
}(ScoreDefaults || {}));//eslint-disable-line no-use-before-define

