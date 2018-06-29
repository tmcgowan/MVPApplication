
//Code to manage creating and presenting peptide > protein > genome feature viewing
var featureViewer = {

    modalHTML: '<div class="modal fade" id="peptide_protein" tabindex="-1" data-backdrop="false" role="dialog"><div class="modal-dialog" role="document">' +
    '<div class="modal-content"><div class="modal-header">' +
    '<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
    '<h4 class="modal-title">##TITLE##</h4></div>' +
    '<div class="modal-body">##BODY##</div>' +
    '<div class="modal-footer">' +
    '<button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>' +
    '</div> </div><!-- /.modal-content --> </div><!-- /.modal-dialog --> </div><!-- /.modal -->',

    requestMSMSRender: function(id){
        featureViewer.publish('renderSingleMSMS', id);
    },

    //Gets CIGAR string from DB and transforms to JSON
    getVarianceData: function(accession, dbsID, pepID, nextFunc) {
        const proteinID = dbsID;
        const peptideID = pepID;
        const lAccession = accession;
        const lNextFunc = nextFunc;
        let url = featureViewer.galaxyConfiguration.href + '/api/datasets/##genomicDataset##?data_type=raw_data&provider=sqlite-table&headers=True&query=';
        let sql = 'SELECT VA.cigar FROM variant_annotation VA WHERE VA.name = "' + accession + '"';

        url = url.replace('##genomicDataset##', featureViewer.cigarDataset);

        /**
         * '191=1X68=1X120=1X133=1X162=1X175=1X2=1X6=1X51=1X232=1X57=1*'
         *  matches
         [['191', '='],
         [ '1', 'X' ],
         [ '68', '=' ],
         [ '1', 'X' ],
         [ '120', '=' ],
         [ '1', 'X' ],
         [ '133', '=' ],
         [ '1', 'X' ],
         [ '162', '=' ],
         [ '1', 'X' ],
         [ '175', '=' ],
         [ '1', 'X' ],
         [ '2', '=' ],
         [ '1', 'X' ],
         [ '6', '=' ],
         [ '1', 'X' ],
         [ '51', '=' ],
         [ '1', 'X' ],
         [ '232', '=' ],
         [ '1', 'X' ],
         [ '57', '=' ] ]
         >

         substitutions: [{loc: 5, ref:'X'},{loc: 10, ref:'X'}],
         deletions: [{loc: 12, missing: 'MILK'}, {loc: 20, missing: 'ELV'}],
         additions: [{loc: 30, added: 'ELV'}],
         aligns: [[40, 150], [20,30]]

         */

        $.get(url + sql, function(data){
            let cigar;// = data.data[1][0];
            const re = RegExp('([0-9]+)([=|X|M|I|D])', 'g');
            let match;
            let obj = {
                substitutions: [],
                deletions: [],
                additions: [],
                aligns: []
            };
            let idx = 0; //Starting offset into the protein sequence.
            let offset;

            if (data.data.length < 2) {
                if (lNextFunc) {
                    lNextFunc(lAccession, proteinID, peptideID);
                } else {
                    featureViewer.queryFeatures(proteinID, peptideID);
                }
            } else {

                cigar = data.data[1][0];

                while (match = re.exec(cigar)) {
                    offset = idx + Number.parseInt(match[1]) - 1;
                    switch (match[2]) {
                        case "=":
                        case "M":
                            obj.aligns.push([idx, offset]);
                            break;
                        case "X":
                            obj.substitutions.push({loc: offset});
                            break;
                        case "D":
                            break;
                        case "I":
                            break;
                    }
                    idx += Number.parseInt(match[1]);
                }
                featureViewer.variantInformation = obj;
                if (lNextFunc) {
                    lNextFunc(lAccession, proteinID, peptideID);
                } else {
                    featureViewer.queryFeatures(proteinID, peptideID);
                }
            }
        });

    },

    //http://localhost:8080/api/datasets/<genomicDataset>?data_type=raw_data&provider=sqlite-table&headers=True&query=
    getGenomicCoordinate: function (accession, dbsID, pepID, nextFunc) {
        var proteinID = dbsID;
        var peptideID = pepID;
        var fv = featureViewer;
        var url = fv.galaxyConfiguration.href + '/api/datasets/##genomicDataset##?data_type=raw_data&provider=sqlite-table&headers=True&query=';
        var sql = 'SELECT feature_cds_map.* FROM feature_cds_map WHERE feature_cds_map.name = "' + accession + '"';
        url = url.replace('##genomicDataset##', fv.genomicDataset);

        //TODO: catch error here for no find.
        $.get(url + sql, function (data) {
            var names = data.data[0];

            featureViewer.genomicCoordinates = [];

            data.data.slice(1).forEach(function (d) {
                var obj = {};
                d.forEach(function (cv, idx) {
                    obj[names[idx]] = cv;
                });
                featureViewer.genomicCoordinates.push(obj);
            });
            if (nextFunc) {
                nextFunc(accession, proteinID, peptideID);
            } else {
                featureViewer.queryFeatures(proteinID, peptideID);
            }

        });
    },

    formatRawData: function (data) {
        var objD = {}; //temporary obj

        /**
         * 0: "start"
         1:"end"
         2:"isDecoy"
         3:"location"
         4:"name"
         5:"id"
         6:"sequence"
         7:"spectrumID"
         8:"spectrumTitle"
         9:"theoretical mass"
         */

        data.data.slice(1).forEach(function (d) {
            var key = d[5]; //the psm id
            if (!(key in objD)) {
                objD[key] = {};
                objD[key].peptidePKID = d[5];
                objD[key].seq = d[6].split('');
                objD[key].start = d[0];
                objD[key].end = d[1];
                objD[key].isDecoy = d[2];
                if (d[3] !== null) {
                    objD[key].mods = [[d[3], d[4]]]; //[mod offset, mod name]
                }
                objD[key].spectrum_identID = d[7];
                objD[key].scores = [data.data[0].slice(10), d.slice(10)];
            } else {
                //Multiple mods exist on the peptide.
                if (d[3] !== null) {
                    objD[key].mods = [[d[3], d[4]]]; //[mod offset, mod name]
                }

            }
            
        });
    
        return objD;
    },

    buildFeatures: function (data) {
        var sqlData = data.sqlData;
        var targetPeptide = featureViewer.peptideList[data.peptideID];
        var genomeArray = (featureViewer.genomicCoordinates) ? featureViewer.genomicCoordinates : null;

        var viewObject = {
            dbkey: featureViewer.dbkey,
            igvDiv: 'igvDiv',
            baseDiv: '#' + featureViewer.baseDiv,
            genome: genomeArray,
            msmsRender: featureViewer.requestMSMSRender,
            protein: (function () {
                var obj = {};
                targetPeptide.proteins.forEach(function (d) {
                    if (d.protein_pkid.toString() === data.proteinID) {
                        obj.name = d.accession + ' : ' + d.description;
                        //Is there a sequence?
                        if (d.sequence) {
                            obj.sequence = d.sequence.split(''); //String to array.
                        } else {
                            obj.sequence = [];
                        }
                    }
                });
                return obj;
            })(),
            peptideList: [],
            variantInformation: featureViewer.variantInformation
        };

        var feats = featureViewer.formatRawData(sqlData);

        Object.keys(feats).forEach(function (k) {
            var obj = {};
            var d = feats[k];
            obj.sequence = d.seq;
            obj.offset = d.start - 1; //index starts at 1, want an offset.
            obj.mismatch = [];
            obj.spectrum_identID = d.spectrum_identID;
            //Does this sequence differ from the protein sequence??
            (function () {
                var p = viewObject.protein.sequence;
                var f = obj.offset;
                obj.sequence.forEach(function (d, i) {
                    if (!( p[i+f] === d)) {
                     obj.mismatch.push(i);
                    }
                });
            })();

            obj.score = (function () {
                var s = '<dl>';
                d.scores[0].forEach(function (a, i) {
                    s += '<dt>' + a + '</dt><dd>' + d.scores[1][i] + '</dd>';
                });
                return s + '</dl>';
            })();

            if (d.hasOwnProperty('mods')) {
                obj.mods = d.mods;
            }

            if (d.peptidePKID.toString() === data.peptideID) {
                //This is feature 1
                obj['class'] = 'psm';
            } else {
                obj['class'] = 'peptide';
            }
            viewObject.peptideList.push(obj);
        });

        $('#' + featureViewer.baseDiv).empty();
        featureViewer.view = new PSMProteinViewer(viewObject);
        featureViewer.view.renderSVG();
        $('#protein_viewer').prepend('<button type="button" id="clear_map" class="btn btn-primary btn-sm">Clear Map</button>');
        $('#clear_map').on('click', function () {
            $('#' + featureViewer.baseDiv).empty();
        });
    },

    queryFeatures: function (dbs_id, pep_id) {
        //The target peptide sequence
        var vScores = '';
        var peptideID = pep_id;
        var sql = 'SELECT\n' +
            '  PE.start, PE.end, PE.isDecoy,\n' +
            '  PM.location, PM.name, PSM.id, PSM.sequence, PSM.spectrumID, PSM.spectrumTitle, ##SCORES##\n' +
            ' FROM\n' +
            '  peptide_evidence PE,\n' +
            '  peptides P, psm_entries PSM\n' +
            '  LEFT OUTER JOIN peptide_modifications PM ON P.id = PM.peptide_ref\n' +
            ' WHERE\n' +
            '  PE.dBSequence_ref = "'+ dbs_id + '" AND\n' +
            '  PE.peptide_ref = P.id AND\n' +
            '  PSM.id = P.id';

        if (featureViewer.visibleScores) {
            featureViewer.visibleScores.forEach(function(cs){
                vScores += 'PSM."' + cs + '",';
            });
            vScores = vScores.slice(0, vScores.lastIndexOf(','));
            sql =  encodeURIComponent(sql.replace("##SCORES##", vScores));
        } else {
            sql = sql.replace("##SCORES##", "PSM.*")
        }


        featureViewer.queryFunc(sql, function (data) {
            featureViewer.buildFeatures({
                sqlData: data,
                peptideID: peptideID,
                proteinID: dbs_id
            });
        });

    },

    showDOM: function () {
        var domS = featureViewer.modalHTML.replace('##TITLE##', 'View Peptides in Protein');
        var s = '';
        var pl = featureViewer.peptideList;

        Object.keys(pl).forEach(function (d, idx) {
            s += '<div class="fv-entry col-md-12"><div class="fv-seq">' +
                '<a role="button" data-toggle="collapse" href="#c_' + idx + '" aria-expanded="true" aria-controls="collapseOne">' + pl[d].sequence + '</a>' +
                '</div>';
            s += '<div id="c_' + idx + '" class="panel-collapse collapse" role="tabpanel">';
            //Iterate over the 1 .. n proteins this peptide is associated to.
            pl[d].proteins.forEach(function (pObj) {
                s += '<div class="fv-protein" dbs_id="' + pObj['protein_pkid'] + '" pep_id="' + d + '">';
                s += '<div class="col-md-12 p_accession">' + pObj['accession'] + '</div>';
                //s += '<div class="col-md-8 p_description">' + pObj['description'] + '</div>';
                s += '</div>';
            });
            s += '</div></div>';
        });

        domS = domS.replace('##BODY##', s);
        $('#master_modal').empty().append(domS);

        $('.fv-protein').on('click', function () {
            if ($(this).text().indexOf('REVERSED') > -1) {
                var s = '<div class="alert alert-warning alert-dismissible" role="alert">' +
                    '<button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
                    '<span aria-hidden="true">&times;</span></button>' +
                    '<strong>Sorry,</strong> I do not map reverse sequence, decoy proteins.</div>';
                $('#' + featureViewer.baseDiv).append(s);
                $('#peptide_protein').modal('hide');
                return;
            }

            //Does the user history have genomic coordinates, variant coordinates, none or both?
            if (featureViewer.genomicDataset) {
                if (featureViewer.cigarDataset) {
                    featureViewer.getGenomicCoordinate(
                        $(this).find('.p_accession').text(),
                        $(this).attr('dbs_id'),
                        $(this).attr('pep_id'),
                        featureViewer.getVarianceData);
                } else {
                    featureViewer.getGenomicCoordinate(
                        $(this).find('.p_accession').text(),
                        $(this).attr('dbs_id'),
                        $(this).attr('pep_id'),
                        null);
                }

            } else if (featureViewer.cigarDataset) {
                featureViewer.getVarianceData(
                    $(this).find('.p_accession').text(),
                    $(this).attr('dbs_id'),
                    $(this).attr('pep_id'),
                    null);
            }
            else {
                featureViewer.queryFeatures($(this).attr('dbs_id'), $(this).attr('pep_id'));
            }

            $('#peptide_protein').modal('hide');
        });

        $('#peptide_protein').find('.btn-primary').on('click', function () {
            $('#peptide_protein').modal('hide');
        });

        $('#peptide_protein').modal('show');
    },

    getProteinData: function (lst) {
        var s = 'SELECT PE.peptide_ref, DB.id, DB.accession, DB.description, DB.sequence, DB.length ' +
            ' FROM db_sequence DB, peptide_evidence PE ' +
            ' WHERE PE.peptide_ref IN (##PEP_IDS##) AND PE.dBSequence_ref = DB.id';
        s = s.replace('##PEP_IDS##', lst.toString());

        featureViewer.queryFunc(s, function (data) {
            data.data.slice(1).forEach(function (d) {
                var obj = {};
                if (!('proteins' in featureViewer.peptideList[d[0]])) {
                    featureViewer.peptideList[d[0]]['proteins'] = [];
                }
                obj['protein_pkid'] = d[1];
                obj['accession'] = d[2];
                obj['description'] = d[3];
                obj['length'] = d[5];
                obj['sequence'] = d[4];
                featureViewer.peptideList[d[0]]['proteins'].push(obj);
            });
            featureViewer.showDOM();
        });
    },

    getPeptideSequences: function (lst) {
        var s = 'SELECT peptides.id, peptides.sequence FROM peptides WHERE peptides.id IN (##IDs##)'
        var pepIDS = [];
        lst.split(',').forEach(function(cv){
            pepIDS.push('"' + cv + '"');
        });
        s = s.replace('##IDs##', pepIDS.toString());

        featureViewer.queryFunc(s, function (data) {
            featureViewer.peptideList = {};
            data.data.slice(1).forEach(function (d) {
                featureViewer.peptideList[d[0]] = {};
                featureViewer.peptideList[d[0]]['sequence'] = d[1];
            });
            featureViewer.getProteinData(pepIDS);
        });

    },

    init: function (obj) {
        featureViewer.galaxyConfiguration = obj.galaxyConfiguration;
        featureViewer.baseDiv = obj.baseDiv;
        featureViewer.queryFunc = obj.queryFunc;
        featureViewer.variantInformation = {
            substitutions: [],
            deletions: [],
            additions: [],
            aligns: []
        };
        featureViewer.dbkey = obj.galaxyConfiguration.dbkey;


        //Do we have Genomic metadata?
        (function () {
            var url = featureViewer.galaxyConfiguration.href + '/api/histories/' + featureViewer.galaxyConfiguration.historyID + '/contents/';

            $.get(url, function (data) {
                //Need to check if delete = True
                data.forEach(function (d) {
                    if (d['extension'] === 'sqlite' && d['deleted'] === false && d['visible'] === true) {
                        $.get(featureViewer.galaxyConfiguration.href + d['url'], function (data) {
                            if (data['peek'].indexOf('feature_cds_map') > -1) {
                               featureViewer.genomicDataset = data['id'];
                            }
                            if (data['peek'].indexOf('variant_annotation') > -1) {
                                featureViewer.cigarDataset = data['id'];
                            }
                        });
                    }
                });
            });
        })();

        featureViewer.subscribe('VisibleScores', function(arg){
            //These are the scores the user wants to see
            featureViewer.visibleScores = arg;
        });

        featureViewer.subscribe('userRequestsViewInProteins', function (arg) {
            //Get sequences and start the process
            featureViewer.getPeptideSequences(arg);
        });

    }
};