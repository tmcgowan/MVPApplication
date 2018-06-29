
/**
 * Module for allowing user to filter PSMs based on one or more score value.
 */
//$('#score-filter-rows').children().length
var ScoreFilterModule = (function(sfm){

    sfm.scoreSummary = null;
    sfm.guiDiv = 'score_filter_div';


    sfm.buildScoreFilerRow = function(sName){
        let divStr = '<div class="row">' +
            '<div class="col-md-5 sf-name"><span class="lead">' + sName + '</span></div>' +
            '<div class="col-md-3">MIN: ' + sfm.scoreSummary[sName]["min_value"] + ' MAX: ' + sfm.scoreSummary[sName]["max_value"] + '  </div>';

        divStr += '<div class="col-md-1"><select class="score_filter_op">' +
            '<option value="gt">&gt;</option><option value="gte">&ge;</option><option value="lt">&lt;</option><option value="lte">&le;</option>' +
            '</select></div>';

        divStr += '<div class="col-md-2"><input class="sf-number" type="number"></div>';
        //divStr += '<div class="col-md-1 sql-AND"></div>';

        return divStr;
    };

    sfm.prepareDOM = function() {
        let dStr = '<div class="panel panel-default"><div class="panel-heading"><h3 class="panel-title">Scores for Filtering</h3>' +
            '</div><div class="panel-body">' +
            '<div class="dropdown"><button class="btn btn-default dropdown-toggle" type="button" id="dropdown-score" data-toggle="dropdown">Score<span class="caret"></span></button>' +
            '<ul class="dropdown-menu" aria-labelledby="dropdown-score">##LIST##</ul></div>' +
            '<div id="score-filter-rows">' +
            '</div>' +
            '<input type="radio" value="AND" name="q-type" class="score_query_type"><label for="all-clause">All conditions are true (AND)</label>' +
            '<span>&nbsp;</span>' +
            '<input type="radio" value="OR" name="q-type" class="score_query_type" checked><label for="any-clause">Any condition is true (OR)</label>' +
            '</div><div class="panel-footer">' +
            '<button type="button" id="score-filter-now" class="btn btn-primary btn-sm">Filter Now</button>' +
            '<button type="button" id="score-filter-clear" class="btn btn-primary btn-sm">Clear Filter</button>' +
            '</div></div>';
        let scores = '';

        Object.keys(sfm.scoreSummary).sort().forEach(function(cv){
            if(sfm.scoreSummary[cv]['score_type'] === 'REAL') {
                scores += '<li class="shadow score_filter_name">' + cv + '</li>';
            }
        });

        dStr = dStr.replace('##LIST##', scores);
        $('#' + sfm.guiDiv).append($.parseHTML(dStr));

        //wire
        $('.score_filter_name').on('click', function(){
            let divStr =  sfm.buildScoreFilerRow($(this).text()); //'<div class="col-md-8">' + $(this).text() + '</div>';
            $('#score-filter-rows').append(divStr);
        });

        $('#score-filter-clear').on('click', function(){
            $('#' + sfm.guiDiv).empty();
            sfm.publish("UserClearedScoreFilter");
        });

        $('#score-filter-now').on('click', function(){
            let filterStr = ' ';
            let ops = {'gt': '>', 'gte': '>=', 'lt': '<', 'lte': '<='};
            //$('input[name=q-type]:checked').val() =>"any-clause" | "all-clause"

            $('#score-filter-rows').children().each(function(){
                filterStr += 'psm_entries."' + $(this).find('.sf-name').text() + '" ' +
                    ops[$(this).find('.score_filter_op').val()] + ' ' + $(this).find('.sf-number').val()  +
                    ' ' + $('input[name=q-type]:checked').val() + ' ';
                });
            filterStr = filterStr.slice(0, filterStr.lastIndexOf(' ' + $('input[name=q-type]:checked').val() + ' '));

            sfm.publish("UserProvidesScoreFiltering", {
                fStr: filterStr,
                data: sfm.peptideObjs
            });
        });
    };

    sfm.prepareScoreFiltering = function(data){
        sfm.peptideObjs = data;
        sfm.prepareDOM();
    };

    sfm.init = function(confObj) {

        if (confObj['baseDiv']) {
            sfm.guiDiv = confObj['baseDiv'];
        }

        sfm.subscribe('ScoreSummaryComplete', function(data){
            sfm.scoreSummary = data;
        });

        sfm.subscribe('ScoreFilteringRequest', function (data) {
            sfm.prepareScoreFiltering(data);
        });

        sfm.subscribe('GlobalScoreFilterRequest', function(){
           sfm.peptideObjs = [];
           sfm.prepareDOM();
        });

    };

    return sfm;
}(ScoreFilterModule||{}));//eslint-disable-line no-use-before-define