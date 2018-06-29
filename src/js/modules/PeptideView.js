/**
 * Module of code for managing and presenting a peptide-centric view of the mz-sqlite db.
 */
var PeptideView = (function (pv) {

    pv.baseQuery = {
        'SELECT': 'spectrum_counts.ENCODED_SEQUENCE AS Sequence, spectrum_counts.SPECTRA_COUNT AS "Spectra Count", protein_counts.PROTEIN_COUNT AS "Protein Count", spectrum_counts.peptide_id',
        'FROM': 'spectrum_counts, protein_counts',
        'WHERE': 'protein_counts.SII_ID = spectrum_counts.SII_ID'
    };
    pv.columnValues = '';
    pv.tableElm = '<table id="data-table" class="table table-bordered" cellspacing="0" width="100%"></table>';
    pv.visibleScores = [];
    pv.forPSMRendering = [];
    pv.filteringFiles = [];
    pv.candidateFiles = {};
    pv.candidateFilesPanel = false;

    pv.prepareFilterSequences = function (lst) {
        if (lst.length > 0) {
            if (lst.indexOf('%') > -1) {
                pv.filterByLike(lst.split(/\s|,|;|:/).toLocaleString());
            } else {
                pv.filterBySequences(lst.split(/\W/).toLocaleString());
            }

        } else {
            console.log('User wants to filter on an empty list');
        }
    };

    pv.domEdit = function () {
        var e = $('#' + pv.baseDiv);
        e.empty();

        e.append($.parseHTML('<div class="panel panel-default"> ' +
            '<div class="panel-heading"><h3 class="panel-title">Peptide Overview</h3></div>' +
            '<div class="row">' +
            '<div class="col-md-6">' +
            '<div id="pep-functions" class="btn-group" role="group">' +
            '<button id="btn-load-from-galaxy" type="button" class="btn btn-primary" disabled="disabled">Load from Galaxy</button>' +
            '<button id="btn-view-in-protein" type="button" class="btn btn-primary" disabled="disabled">View in Protein</button>' +
            '<div class="btn-group">' +
            '<button type="button" class="btn btn-primary render-btn">Render</button>' +
            '<button type="button" class="btn btn-primary dropdown-toggle render-btn" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"><span class="caret"></span><span class="sr-only">Toggle Dropdown</span></button>' +
            '<ul id="score-type-ul" class="dropdown-menu"></ul>' +
            '</div></div></div>' +
            '<div class="col-md-1"></div><div class="col-md-5"><input class="pep-filter" size="40" type="text" placeholder="Peptide Sequences for Filtering"/>' +
            '<button type="button" class="pep-filter btn btn-primary">Filter</button><button type="button" class="pep-filter btn btn-primary">Clear</button></div>' +
            '</div>' +
            '<div class="panel-body">' + pv.tableElm + '</div>' +
            '<div class="panel-footer">' +
            '<div class="btn-group" role="group">' +
            '<button type="button" id="psm-all" class="btn btn-primary">Selected Peptide PSMs</button>' +
            '<div class="btn-group" role="group">' +
            '<button type="button" id="psm-filtered" class="btn btn-primary">PSMs Filtered by Score</button> ' +
            '<button type="button" class="btn btn-primary dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">' +
            '<span class="caret"></span><span class="sr-only">Toggle Dropdown</span></button>' +
            '<ul class="dropdown-menu" id="psm-filter-ul">' +
            '<li value="global"><a href="#">Global Peptides</a></li>' +
            '<li value="current"><a href="#">Current Peptides</a></li></ul>' +
            '</div></div></div>' +
            '</div>'));
        $('.render-btn').attr('disabled', 'disabled');


        //Wire
        $('#psm-filter-ul li').on('click', function () {
            let type = $(this).attr('value');

            if (type === 'current') {
                if (pv.forPSMRendering.length === 0) {
                    let table = $('#data-table').DataTable();
                    table.$('tr').toggleClass('selected-peptide');
                    table.$('.selected-peptide').each(function () {
                        pv.forPSMRendering.push(table.$(this).data());
                    });
                    pv.publish("ScoreFilteringRequest", pv.forPSMRendering);
                }
            } else {
                pv.publish("GlobalScoreFilterRequest");
            }
        });

        $('#psm-all').on('click', function () {
            if (pv.forPSMRendering.length > 0) {
                pv.appendDetailDOM('Selected Peptides');
                pv.createDetailTable(pv.forPSMRendering);
            }
        });

        //filter code
        $('button.pep-filter').on('click', function () {
            if ($(this).text() === 'Filter') {
                pv.prepareFilterSequences($('input.pep-filter').val())
            } else {
                //Clear any existing filtering
                $('input.pep-filter').val('');
                $('#data-table').DataTable().search('');
                $('#data-table').DataTable().draw();
            }

        });
    };

    pv.destroyDetailTable = function () {
        var el = $('#detail_div');
        el.empty();
    };

    pv.appendDetailDOM = function (sequence) {
        var el = $('#detail_div');
        el.empty();
        el.append($.parseHTML('<div class="panel panel-default"> ' +
            '<div class="panel-heading" style="background-color: lightblue;">' +
            '<div class="row">' +
            '<div class="col-md-10"><h3 class="panel-title">PSM Detail for ' + sequence + '</h3></div>' +
            '<div class="col-md-2"><span><button class="glyphicon glyphicon-remove kill-detail-table"></button></span></div></div>' +
            '</div>' +
            '<div class="panel-body"><table id="data-detail-table" class="table table-bordered" cellspacing="0" width="100%"></table></div></div>'));

        $('.kill-detail-table').on('click', pv.destroyDetailTable);

    };

    pv.buildScoreQuery = function () {
        var q = " psm_entries.sequence, psm_entries.spectrumID, psm_entries.spectrumTitle, ";
        pv.visibleScores.forEach(function (cv) {
            q += 'psm_entries."' + cv + '",';
        });
        q = q.slice(0, q.lastIndexOf(','));
        return q;
    };

    //an array of id objects
    pv.createDetailTable = function (idArray, fStr) {
        let idStr = '';
        let filterStr = fStr || null;

        idArray.forEach(function (o) {
            idStr += '"' + o.key + '",';
        });

        idStr = idStr.slice(0, idStr.lastIndexOf(','));

        let setDetailRowClick = function () {
            $('#data-detail-table').find('tbody').on('click', 'tr', function () {
                $(this).toggleClass('selected-peptide');
                pv.publish('renderPSMForPeptide', {
                    pkid: $(this).data().key,
                    spectrumID: $(this).data().fObj['"spectrumID"'],
                    spectrumTitle: $(this).data().fObj['"spectrumTitle"']
                });
            });
        };

        let option = {
            tableDivID: 'data-detail-table',
            rowIDField: 'id',
            baseQuery: {
                'SELECT': 'psm_entries.*',
                'FROM': ' psm_entries',
                'WHERE': 'psm_entries.id in (' + idStr + ') '
            },
            href: pv.galaxyConfiguration.href,
            datasetID: pv.galaxyConfiguration.datasetID,
            callBackFN: setDetailRowClick
        };

        if (idStr.length === 0) {
            //Do not restrict psm_entries.id, this is a global request
            option.baseQuery.WHERE = '';
        }

        if (fStr) {
            if (option.baseQuery.WHERE.length === 0) {
                option.baseQuery.WHERE += ' ' + fStr + ' ';
            } else {
                option.baseQuery.WHERE += ' AND ' + fStr + ' ';
            }

        }

        if (pv.visibleScores.length > 0) {
            option.baseQuery['SELECT'] = pv.buildScoreQuery();
        }

        option.scoreSummary = true;

        psmDetailDP = new AjaxDataProvider(option);
        psmDetailDP.generateTable();
    };

    pv.wireTable = function () {
        //Table is initialized
        pv.publish('dataTableInitialized', {});
        let table = $('#data-table').DataTable();

        table.on('draw', function () {
            pv.forPSMRendering = [];
        });

        $('#data-table tbody').on('click', 'tr', function () {
            let t = $('#data-table').DataTable();
            //New approach
            if ($(this).hasClass('selected-peptide')) {
                $(this).toggleClass('selected-peptide');
                let d = t.$(this).data();
                if (pv.forPSMRendering.indexOf(d) > -1) {
                    pv.forPSMRendering.splice(pv.forPSMRendering.indexOf(d), 1);
                }
            } else {
                //$('#data-table tbody tr').each(function(){$(this).removeClass('selected-peptide')});
                $(this).addClass('selected-peptide');
                pv.forPSMRendering.push(t.$(this).data());

                //pv.createDetailTable(t.$('tr.selected-peptide').data());
            }

        });
    };

    pv.makeTableAndQuery = function (sqlStr) {
        pv.domEdit();

        pv.dataProvider = new AjaxDataProvider({
            baseQuery: sqlStr,
            rowIDField: 'PEPTIDE_ID',
            href: pv.galaxyConfiguration.href,
            datasetID: pv.galaxyConfiguration.datasetID,
            tableDivID: 'data-table',
            searchColumn: 'spectrum_counts.SEQUENCE',
            callBackFN: pv.wireTable,
            sequenceFormatter: PeptideModifications.htmlFormatSequences,
            modificationCount: pv.galaxyConfiguration.tableRowCount.peptide_modifications
        });

        pv.dataProvider.generateTable();

    };


    pv.clearSeachFiltering = function () {
        $('#data-table').DataTable().search('').draw();
    };

    pv.setSearchFiltering = function (s) {
        $('#data-table').DataTable().search(s).draw();
    };

    /**
     * User wishes to filter by a large list of peptide sequences.
     * List comes from current Galaxy history.
     * @param listSeq
     */
    pv.filterBySequences = function (listSeq) {
        let escapedStr = '';

        //Clear any existing filtering
        PeptideView.clearSeachFiltering();

        listSeq.split(',').forEach(function (cv, idx) {
            if (idx > 0) {
                escapedStr += ',"' + cv + '"';
            } else {
                escapedStr += '"' + cv + '"';
            }
        });

        PeptideView.setSearchFiltering(escapedStr);
    };

    pv.filterByLike = function (listSeq) {
        let rStr = '';

        PeptideView.clearSeachFiltering();

        rStr += ' LIKE ' + '"' + listSeq.split(',')[0] + '"';

        PeptideView.setSearchFiltering(rStr);
    }

    pv.prepareRenderScores = function (data) {
        var liS = '';

        $('#score-type-ul').empty();

        data.forEach(function (cv) {
            var s = '<li s_name="' + cv + '" s_dir="ASC"><a href="#"><strong>' + cv + '</strong> ASC</a></li>';
            s += '<li s_name="' + cv + '" s_dir="DSC"><a href="#"><strong>' + cv + '</strong> DSC</a></li>';

            if (cv.indexOf('PeptideShaker') > -1) {
                //prepend in str
                liS = s.concat(liS);
            } else {
                //append in str
                liS = liS.concat(s);
            }
        });

        $('#score-type-ul').append($.parseHTML(liS));
        $('#score-type-ul li').on('click', function () {
            var scoreName = $(this).attr('s_name');
            var sortDir = $(this).attr('s_dir');
            var rowData = $('#data-table').DataTable().rows().data();
            var numRows = rowData.length;
            var idx;
            var peptides = [];

            for (idx = 0; idx < numRows; idx += 1) {
                peptides.push(rowData[idx]['"PEPTIDE_ID"']);
            }

            pv.publish('renderBestPSM', {
                peptideIDs: peptides.toString(),
                scoreField: scoreName,
                sortDir: sortDir
            });
        });
        //Render btn now is operational
        $('.render-btn').removeAttr("disabled");

    };

    pv.resetTable = function () {
        let tbl = $('#data-table').DataTable();
        tbl.destroy();
        $('#data-table').empty();
        pv.dataProvider = null;
        pv.makeTableAndQuery(pv.baseQuery);
    };

    pv.reBuildTable = function (name, value) {
        let tbl = $('#data-table').DataTable();
        let q = {
            'SELECT': 'DISTINCT spectrum_counts.ENCODED_SEQUENCE AS Sequence, spectrum_counts.SPECTRA_COUNT AS "Spectra Count", protein_counts.PROTEIN_COUNT AS "Protein Count", spectrum_counts.peptide_id',
            'FROM': 'spectrum_counts, protein_counts, psm_entries',
            'WHERE': 'protein_counts.SII_ID = spectrum_counts.SII_ID AND  psm_entries.id = spectrum_counts.PEPTIDE_ID AND psm_entries."' + name + '" >= ' + value
        };
        tbl.destroy();
        $('#data-table').empty();
        pv.dataProvider = null;
        pv.makeTableAndQuery(q);
    };

    pv.getPeptideFilterSequences = function (files) {

    };

    pv.buildFileSelectPanel = function () {
        let str = '<div id="user-filter-list" class="panel panel-default">' +
            '  <div class="panel-heading">Choose Tabular File(s) for Peptide Filtering</div>\n' +
            '  <div class="panel-body">##FILES_HERE##</div>' +
            '  <div class="panel-footer">' +
            '  <div class="btn-group" role="group">' +
            '  <button type="button" class="btn btn-primary" id="filter-with">Use for Filtering</button>' +
            '  <button type="button" class="btn btn-primary" id="cancel-this">Cancel</button></div>' +
            '  </div></div>';

        let fDiv = '<div class="row">';
        Object.keys(pv.candidateFiles).forEach(function (key) {
            fDiv += '<div class="col-md-11 shadow candidate-file" dID="' + key + '">' + pv.candidateFiles[key]['name'] + '</div>'
        });
        fDiv += '</div>';
        str = str.replace('##FILES_HERE##', fDiv);

        $('#overview_row').prepend($.parseHTML(str));
        $('.candidate-file').on('click', function () {
            if ($(this).hasClass('shadow')) {
                $(this).removeClass('shadow');
                $(this).addClass('used-for-filtering');
            } else {
                $(this).addClass('shadow');
                $(this).removeClass('used-for-filtering');
            }
        });

        $('#cancel-this').on('click', function(){
            $('.candidate-file.used-for-filtering').each(function () {
                $(this).removeClass('used-for-filtering');
                $(this).addClass('shadow');
            });
            $('#user-filter-list').toggle();
        });

        $('#filter-with').on('click', function () {
            pv.filteringFiles = [];
            $('.candidate-file.used-for-filtering').each(function () {
                pv.filteringFiles.push(pv.candidateFiles[$(this).attr('dID')]);
            });
            if (pv.filteringFiles.length > 0) {
                pv.publish('ParseCandidateFiles', pv.filteringFiles);
            }
            $('#user-filter-list').toggle();
        });

        pv.candidateFilesPanel = true;

    };

    pv.init = function (confObj) {
        pv.baseDiv = confObj.baseDiv;
        pv.galaxyConfiguration = confObj.galaxyConfiguration;

        pv.makeTableAndQuery(pv.baseQuery);

        pv.subscribe('UserRemovedFDRFilter', function () {
            pv.resetTable();
        });
        pv.subscribe('VisibleScores', function (arg) {
            //These are the scores the user wants to see
            pv.visibleScores = arg;
            pv.prepareRenderScores(arg);
        });

        pv.publish('RequestVisibleScores');

        pv.publish('RequestRankedScores', {});

        pv.subscribe('CandidateFilesParsed', function (arg) { //TODO: this needs to be an accessible function
            let od = $('#overview_div');
            pv.filteringFiles = arg.data;
            od.removeClass('col-md-12');
            od.addClass('col-md-8');
            $('#data-table').DataTable().draw();
            SequenceByFile.init({
                pageSize: 50,
                seqData: pv.filteringFiles,
                elID: 'overview_row',
                callBack: pv.filterBySequences
            });
        });

        pv.subscribe('CandidateFilesAvailable', function (arg) {
            var b = $('#btn-load-from-galaxy');
            var bProt = $('#btn-view-in-protein');
            //Can allow the user to load a peptide file from history.
            b.removeAttr("disabled");

            arg.forEach(function (cv) {
                pv.candidateFiles[cv.obj['id']] = cv;
            });

            b.on('click', function () {
                if (pv.candidateFilesPanel) {
                    $('#user-filter-list').toggle();
                } else {
                    pv.buildFileSelectPanel();
                }
            });
            bProt.removeAttr('disabled');
            bProt.on('click', function () {
                var ids = [];
                var data = $('#data-table').DataTable().data();
                for (var idx = 0; idx < data.length; idx++) {
                    ids.push(data[idx]["\"PEPTIDE_ID\""]);
                }
                pv.publish('userRequestsViewInProteins', ids.toString());
            });
        });

        pv.subscribe("UserProvidesScoreFiltering", function (data) {
            pv.appendDetailDOM('Score Filtered PSMs');
            pv.createDetailTable(data['data'], data['fStr']);
        });

        pv.subscribe("UserClearedScoreFilter", function () {
            let table = $('#data-table').DataTable();
            table.$('tr').removeClass('selected-peptide');
            pv.forPSMRendering = [];
        });

    };

    return pv;

}(PeptideView || {}));// eslint-disable-line no-use-before-define