


/**
 * Module for handling GUI presentation and data filtering based on the protein FDR threshold used by the
 * search application.
 */
var FDRPresentation = (function(fdr){

    fdr.ignoreScores = ["theoretical mass","tic","score_name"];
    fdr.scoreName = null;
    fdr.scoreValue = null;
    fdr.softwareName = null;
    fdr.softwareVersion = null;
    fdr.fdrProtocolName = null;
    fdr.fdrProtocolValue = null;

    //Create a d3 scatterplot for the PSM entries
    fdr.fdrLinePlot = function() {
        let margin = {left: 25, right: 5, top: 5, bottom: 5};

        //Iterate over every score pair and create a D3 line plot.
        Object.keys(FDRPresentation.graphPackage).forEach(function (k, kIdx) {
            let width = Math.floor($('#panel_' + kIdx).width()/100)*100;
            let height = Math.floor((width*.666)/100)*100;

            let maxScore = d3.max(FDRPresentation.graphPackage[k].passed);
            let maxIndex = d3.min([FDRPresentation.graphPackage[k].passed.length, FDRPresentation.graphPackage[k].failed.length]);

            let y = d3.scaleLinear()
                .domain([0, maxScore])
                .range([height, 0]);
            let x = d3.scaleLinear()
                .domain([0, maxIndex])
                .range([0,width]);

            let yAxis = d3.axisLeft(y);
            let svg = d3.select('#panel_' + kIdx)
                .append('svg')
                .attr("height", height + 10)
                .attr("width", width + 10)
                .attr("name", k);

            let chartGroup = svg.append("g")
                .attr("transform","translate("+margin.left+","+margin.top+")");

            let line = d3.line()
                .x(function(d,i){
                    return x(i);
                })
                .y(function (d) {
                    return y(d);
                });

            chartGroup.append("path")
                .attr("class","fdr_path_passed")
                .attr("d", line(FDRPresentation.graphPackage[k].passed));

            chartGroup.append("text")
                .attr("transform", "translate(" + (width-(width/2)) + "," + y(FDRPresentation.graphPackage[k].passed[FDRPresentation.graphPackage[k].passed.length-1] - 5) + ")")
                .attr("dy", ".35em")
                .attr("text-anchor", "start")
                .style("fill", "black")
                .text("Passed Threshold");

            chartGroup.append("path")
                .attr("class", "fdr_path_failed")
                .attr("d", line(FDRPresentation.graphPackage[k].failed));

            chartGroup.append("text")
                .attr("transform", "translate(" + (width-(width/2)) + "," + y(FDRPresentation.graphPackage[k].failed[FDRPresentation.graphPackage[k].failed.length-1] + 5) + ")")
                .attr("dy", ".35em")
                .attr("text-anchor", "start")
                .style("fill", "orange")
                .text("Failed Threshold");

            chartGroup.append('g').attr('class', 'y axis').call(yAxis);

            svg.on("click",function(){
                let coords = d3.mouse(this);
                let yValue = Math.floor(y.invert(coords[1]));
                //let xValue = Math.floor(x.invert(coords[0]));
                let scoreName = $(this).attr("name");

                d3.select('line.score_threshold_line').remove();

                $('span#filter_warning').text('Filter PSMs at ' + scoreName + ' >= ');
                $('input#y_filter_value').val(yValue).attr("style", "visibility: block; width: 30px");
                $('button#psm_filter_now').attr("style", "visibility: block");
                svg.append("line")
                    .style("stroke","blue")
                    .style("stroke-width", "2px")
                    .attr("class", "score_threshold_line")
                    .attr("x1", x(0))
                    .attr("y1", y(yValue))
                    .attr("x2", x(maxIndex))
                    .attr("y2", y(yValue));
                fdr.scoreName = scoreName;
                fdr.scoreValue = yValue;
            });
        });
    };

    //Get the actual scores for the discovered fields.
    fdr.getScoreData = function(fieldNames){
        let qStr = 'SELECT PSM.passThreshold, ';
        let baseURL = fdr.href + '/api/datasets/' + fdr.datasetID + '?data_type=raw_data&provider=sqlite-table&headers=True&query=';
        let url = baseURL;

        fieldNames.forEach(function(cv){
            qStr += 'PSM."' + cv + '",';
        });
        qStr = qStr.slice(0, qStr.lastIndexOf(','));
        qStr += ' FROM psm_entries PSM;';
        url += encodeURIComponent(qStr);

        $.get(url, function(data) {
            var graphPackage = {};
            var fNames = data.data[0].slice(1);
            data.data[0].slice(1).forEach(function (sn) {
                graphPackage[sn] = {};
                graphPackage[sn].passed = [];
                graphPackage[sn].failed = [];
            });
            data.data.slice(1).forEach(function (cv) {
                cv.slice(1).forEach(function (x, xidx) {
                    if (cv[0] === "true") {
                        graphPackage[fNames[xidx]].passed.push(x);
                    } else {
                        graphPackage[fNames[xidx]].failed.push(x);
                    }
                });
            });
            fNames.forEach(function(y){
                graphPackage[y].passed.sort(function(a,b){return a-b;});
                graphPackage[y].failed.sort(function(a,b){return b-a;});
            });
            FDRPresentation.graphPackage = graphPackage;

            url = baseURL + encodeURIComponent("SELECT protein_detection_protocol.name,protein_detection_protocol.value, " +
                "  analysis_software.name, analysis_software.version " +
                "   FROM protein_detection_protocol, analysis_software");

            $.get(url, function(data){
                FDRPresentation.fdrProtocolName = data.data[1][0];
                FDRPresentation.fdrProtocolValue = data.data[1][1];
                FDRPresentation.softwareName = data.data[1][2];
                FDRPresentation.softwareVersion = data.data[1][3];
                FDRPresentation.preparePanel();
                FDRPresentation.fdrLinePlot();
                $('#' + FDRPresentation.divID).hide(); //Start hidden.
                FDRPresentation.publish("FDRDataPrepared");
            });
        });

    };

    //Get REAL scores that have full coverage. These scores will be used in plots
    fdr.getScores = function(){
        let qStr = 'SELECT score_summary.score_name FROM score_summary WHERE score_summary.pct_scores_present = 1 AND \n' +
            'score_summary.score_type = "REAL"';
        let  url = fdr.href + '/api/datasets/' + fdr.datasetID + '?data_type=raw_data&provider=sqlite-table&headers=True&query=';
        url += encodeURIComponent(qStr);

        $.get(url, function(data){
            var graphScores = [];
            data.data.slice(1).forEach(function(cv){
                if (FDRPresentation.ignoreScores.indexOf(cv[0]) === -1) {
                    graphScores.push(cv[0]);
                }
            });
            FDRPresentation.getScoreData(graphScores);
        });

    };

    //Builds GUI panel for user presentation
    fdr.preparePanel = function() {
        let domStr = '<div class="panel panel-primary">' +
            '<div class="panel-heading">' +
            '<h3 class="panel-title">' +
            '<a role="button" data-toggle="collapse" data-parent="#accordion" href="#collapseOne" aria-expanded="true" aria-controls="collapseOne">' +
            'Search Application FDR Protocol</a></h3></div>' +
            '<div id="collapseOne" class="panel-collapse collapse in" role="tabpanel" aria-labelledby="headingOne">' +
            '<div class="panel-body"><div class="row"><div class="col-md-12"><h5>##SOFTWARE_NAME## (##SOFTWARE_VERSION##) ##FDR_PROTOCOL_NAME## at ##FDR_PROTOCOL_VALUE##</h5></div></div><br>' +
            '<span id="filter_warning"></span><input id="y_filter_value" type="text" style="visibility: hidden; width: 30px"><button id="psm_filter_now" style="visibility: hidden">Filter</button>' +
            '<button id="psm_clear_filter" style="visibility: hidden">Clear</button>' +
            '##SCORE_DOM##' +
            '</div></div></div>';

        //let numGraphPanels = Object.keys(FDRPresentation.graphPackage).length;
        let sDom = '<div class="row">';
        //let placed = 0;
        Object.keys(FDRPresentation.graphPackage).forEach(function(k, kIdx){
            sDom += '<div class="col-md-6 panel_graph" id="panel_' + kIdx + '"><h5>' + k + '</h5></div>';
        });
        sDom += '</div>';

        domStr = domStr.replace('##SCORE_DOM##', sDom);
        domStr = domStr.replace('##SOFTWARE_NAME##', fdr.softwareName);
        domStr = domStr.replace('##SOFTWARE_VERSION##', fdr.softwareVersion);
        domStr = domStr.replace('##FDR_PROTOCOL_NAME##', fdr.fdrProtocolName);
        domStr = domStr.replace('##FDR_PROTOCOL_VALUE##', fdr.fdrProtocolValue);

        $('#' + fdr.divID).append($.parseHTML(domStr));

        //Wire
        $('button#psm_filter_now').on('click', function(){
            fdr.callBackFN(fdr.scoreName, fdr.scoreValue);
            $('button#psm_clear_filter').attr("style", "visibility: block");
        });
        $('button#psm_clear_filter').on('click', function(){
            fdr.publish('UserRemovedFDRFilter');
            d3.select('line.score_threshold_line').remove();
        })
    };

    fdr.init = function(confObj){
        fdr.href = confObj.href;
        fdr.datasetID = confObj.datasetID;
        fdr.divID = confObj.divID;
        fdr.callBackFN = confObj.callBackFN;
        fdr.getScores();
    };

    return fdr;
}(FDRPresentation || {}));//eslint-disable-line no-use-before-define

